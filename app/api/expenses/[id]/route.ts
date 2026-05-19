import mongoose from "mongoose";
import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";
import Settlement from "@/lib/models/Settlement";
import User from "@/lib/models/User";
import { toCents, fromCents, distributeEvenly, distributeByPercentage, validateExactSplits, formatMoney } from "@/lib/money";
import { validateSplits } from "@/lib/validate-splits";
import { logAction } from "@/lib/audit";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { notify } from "@/lib/notify";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";
import { getUserRole } from "@/lib/group-permissions";

type SplitType = "equal" | "percentage" | "exact";
type CustomSplit = { user: string; value: number };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) return unauthorizedResponse();

    const rateLimitResult = await checkRateLimit(request, 'mutation');
    if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult);

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("Invalid expense id.", 400);

    const expense = await Expense.findById(id);
    if (!expense) return errorResponse("Expense not found.", 404);

    // Permission: creator OR group owner/admin can edit
    const group = await Group.findById(expense.group)
      .select("members currency")
      .lean() as any;
    if (!group) return errorResponse("Group not found.", 404);

    const isCreator = String(expense.createdBy) === String(authUserId);
    const userRole = getUserRole(group.members ?? [], authUserId);
    const isGroupManager = userRole === "owner" || userRole === "admin";

    if (!isCreator && !isGroupManager) {
      return unauthorizedResponse();
    }

    // Block editing if any split participant has a confirmed settlement
    // (the expense is "locked" once money has moved)
    const splitUserIds = (expense.splits as any[]).map((s: any) =>
      String(s.user?._id ?? s.user)
    );
    const hasSettledSplit = await Settlement.exists({
      group: expense.group,
      status: "confirmed",
      $or: [
        { fromUser: { $in: splitUserIds } },
        { toUser: { $in: splitUserIds } },
      ],
    });
    if (hasSettledSplit) {
      return errorResponse(
        "This expense cannot be edited because one or more participants have already settled. Void and re-add it instead.",
        409
      );
    }

    const currency: string = group.currency || "USD";
    const memberIds: string[] = group.members.map((m: any) => String(m.user));

    const body = await request.json();
    const description = String(body?.description ?? expense.description).trim();
    const rawAmount   = body?.amount !== undefined ? Number(body.amount) : fromCents(expense.amount, currency);
    const paidBy      = body?.paidBy ? String(body.paidBy) : String(expense.paidBy);
    const splitType   = (body?.splitType ?? expense.splitType) as SplitType;
    const category    = body?.category ? String(body.category) : String(expense.category || "other");
    const customSplits: CustomSplit[] = Array.isArray(body?.customSplits) ? body.customSplits : [];
    const receiptUrl  = body?.receiptUrl !== undefined ? body.receiptUrl : (expense as any).receiptUrl;

    if (!description) return errorResponse("Description is required.", 400);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return errorResponse("Amount must be greater than zero.", 400);
    }
    if (!memberIds.includes(paidBy)) {
      return errorResponse("paidBy must belong to the selected group.", 400);
    }

    const amountCents = toCents(rawAmount, currency);
    const payerIndex  = memberIds.indexOf(paidBy);

    let splitCents: number[];
    try {
      if (splitType === "equal") {
        splitCents = distributeEvenly(amountCents, memberIds.length, payerIndex);
      } else if (splitType === "percentage") {
        const percentages = memberIds.map((id) => {
          const cs = customSplits.find((s) => String(s.user) === id);
          return cs ? Number(cs.value) : 0;
        });
        splitCents = distributeByPercentage(amountCents, percentages);
      } else {
        splitCents = memberIds.map((id) => {
          const cs = customSplits.find((s) => String(s.user) === id);
          return toCents(cs ? Number(cs.value) : 0, currency);
        });
        const { valid, diff } = validateExactSplits(amountCents, splitCents);
        if (!valid) {
          return errorResponse(
            `Exact splits sum to ${formatMoney(amountCents - diff, currency)} ` +
              `but expense is ${formatMoney(amountCents, currency)}.`,
            400
          );
        }
      }
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Invalid split input.", 400);
    }

    const splitInputs = memberIds.map((id, i) => ({ userId: id, amountCents: splitCents[i] }));
    const validation = validateSplits(amountCents, splitInputs, splitType, currency);
    if (!validation.valid) {
      return errorResponse(`Invalid splits: ${validation.errors.join("; ")}`, 400);
    }

    // Snapshot before for audit and edit history
    const before = {
      description: expense.description,
      amount: expense.amount,
      splitType: expense.splitType,
    };

    // Capture full before-snapshot for editHistory (Requirements 12.2, 12.3, 12.4)
    const editHistorySnapshot = {
      description: expense.description,
      amount: expense.amount,
      category: String(expense.category || "other"),
      splits: (expense.splits as Array<{ user: mongoose.Types.ObjectId; amount: number }>).map((s) => ({
        user: s.user,
        amount: s.amount,
      })),
    };

    // Determine which fields changed
    const newSplits = memberIds.map((id, i) => ({
      user: new mongoose.Types.ObjectId(id),
      amount: splitCents[i],
    }));
    const changedFields: string[] = [];
    if (description !== editHistorySnapshot.description) changedFields.push("description");
    if (amountCents !== editHistorySnapshot.amount) changedFields.push("amount");
    if (category !== editHistorySnapshot.category) changedFields.push("category");
    const splitsChanged =
      newSplits.length !== editHistorySnapshot.splits.length ||
      newSplits.some((ns, i) => {
        const os = editHistorySnapshot.splits[i];
        return !os || String(ns.user) !== String(os.user) || ns.amount !== os.amount;
      });
    if (splitsChanged) changedFields.push("splits");

    expense.description = description;
    expense.amount      = amountCents;
    expense.paidBy      = new mongoose.Types.ObjectId(paidBy) as any;
    expense.category    = category;
    expense.splitType   = splitType;
    expense.splits      = newSplits as any;
    if (receiptUrl !== undefined) (expense as any).receiptUrl = receiptUrl;
    expense.updatedAt = new Date();
    await expense.save();

    // Append edit history entry after successful save (Requirements 12.3, 12.4)
    await Expense.findByIdAndUpdate(expense._id, {
      $push: {
        editHistory: {
          editedBy: new mongoose.Types.ObjectId(authUserId),
          editedAt: new Date(),
          changes: changedFields,
          before: editHistorySnapshot,
        },
      },
    });

    await invalidateBalanceCache(String(expense.group));

    const actor = await User.findById(authUserId).select("name").lean() as any;
    await logAction({
      action: "expense.edited",
      actorId: authUserId,
      actorName: actor?.name ?? authUserId,
      groupId: String(expense.group),
      resourceId: id,
      before,
      after: { description, amount: amountCents, splitType },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "name email avatar avatarUrl")
      .populate("createdBy", "name email")
      .populate("splits.user", "name email avatar avatarUrl")
      .lean();

    return successResponse({ expense: populated });
  } catch (error: unknown) {
    logError('[expenses PATCH]', error);
    return errorResponse("Failed to update expense.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("Invalid expense id.", 400);

    const expense = await Expense.findById(id).select("createdBy group description amount");
    if (!expense) return errorResponse("Expense not found.", 404);

    // Permission: creator OR group owner/admin
    const groupForPerm = await Group.findById(expense.group).select("members").lean() as any;
    const isCreator = String(expense.createdBy) === String(authUserId);
    const userRoleForDelete = getUserRole(groupForPerm?.members ?? [], authUserId);
    const isGroupManagerForDelete = userRoleForDelete === "owner" || userRoleForDelete === "admin";
    if (!isCreator && !isGroupManagerForDelete) return unauthorizedResponse();

    const groupId = String(expense.group);
    const snapshot = { description: expense.description, amount: expense.amount };

    // Collect split participants before deleting
    const expenseFull = await Expense.findById(id)
      .select("splits description amount currency group")
      .lean() as any;
    const participantIds: string[] = (expenseFull?.splits ?? [])
      .map((s: any) => String(s.user))
      .filter((uid: string) => uid !== authUserId);

    await Expense.findByIdAndDelete(id);
    await invalidateBalanceCache(groupId);

    const actor = await User.findById(authUserId).select("name").lean() as any;
    const actorName = actor?.name ?? authUserId;

    await logAction({
      action: "expense.deleted",
      actorId: authUserId,
      actorName,
      groupId,
      resourceId: id,
      before: snapshot,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Notify all participants that the expense was removed
    const group = await Group.findById(groupId).select("name currency").lean() as any;
    const currency: string = group?.currency ?? expenseFull?.currency ?? "USD";

    for (const participantId of participantIds) {
      await notify({
        userId:    participantId,
        type:      "expense_deleted",
        title:     "Expense removed",
        body:      `${actorName} deleted "${snapshot.description}" (${formatMoney(snapshot.amount, currency)}) from ${group?.name ?? "your group"}`,
        groupId,
        actorName,
        currency,
        resourceId: id,
      });
    }

    return successResponse({ message: "Expense deleted." });
  } catch (error: unknown) {
    logError('[expenses DELETE]', error);
    return errorResponse("Failed to delete expense.", 500);
  }
}

