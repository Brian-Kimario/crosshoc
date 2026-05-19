import mongoose from "mongoose";
import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import { toCents, distributeEvenly, distributeByPercentage, validateExactSplits, fromCents, formatMoney } from "@/lib/money";
import { validateSplits } from "@/lib/validate-splits";
import { logAction } from "@/lib/audit";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { notify } from "@/lib/notify";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

type SplitType = "equal" | "percentage" | "exact";

type CustomSplit = {
  user: string;
  value: number;
};

async function loadGroupForMember(groupId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) return null;

  const group = await Group.findById(groupId)
    .select("members currency status")
    .lean() as any;
  if (!group) return null;

  const isMember = group.members.some(
    (m: any) => String(m.user) === String(userId)
  );
  return isMember ? group : undefined;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) return unauthorizedResponse();

    const rateLimitResult = await checkRateLimit(request, 'mutation');
    if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult);

    const body = await request.json();
    const groupId    = String(body?.groupId || "");
    const description = String(body?.description || "").trim();
    const rawAmount  = Number(body?.amount);
    const paidBy     = String(body?.paidBy || "");
    const splitType  = String(body?.splitType || "equal") as SplitType;
    const category   = String(body?.category || "other").trim();
    const customSplits: CustomSplit[] = Array.isArray(body?.customSplits) ? body.customSplits : [];
    const receiptUrl = body?.receiptUrl ? String(body.receiptUrl) : undefined;

    if (!description) return errorResponse("Description is required.", 400);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return errorResponse("Amount must be greater than zero.", 400);
    }
    if (!["equal", "percentage", "exact"].includes(splitType)) {
      return errorResponse("splitType must be equal, percentage, or exact.", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(paidBy)) {
      return errorResponse("paidBy must be a valid user.", 400);
    }

    const group = await loadGroupForMember(groupId, authUserId);
    if (group === null) return errorResponse("Group not found.", 404);
    if (group === undefined) return unauthorizedResponse();

    if (group.status === "archived") {
      return errorResponse("Cannot add expenses to an archived group", 403);
    }

    const currency: string = group.currency || "USD";
    const memberIds: string[] = group.members.map((m: any) => String(m.user));

    if (!memberIds.includes(paidBy)) {
      return errorResponse("paidBy must belong to the selected group.", 400);
    }

    // Convert to integer cents
    const amountCents = toCents(rawAmount, currency);
    const payerIndex  = memberIds.indexOf(paidBy);

    // Build splits in cents using the money utility
    let splitCents: number[];
    try {
      if (splitType === "equal") {
        // Use customSplits to determine which members are included (non-zero value = included)
        // If no customSplits provided, fall back to all members
        const includedIds = customSplits.length > 0
          ? customSplits.filter((s) => s.value > 0).map((s) => String(s.user))
          : memberIds;
        const includedCount = includedIds.length > 0 ? includedIds.length : memberIds.length;
        const finalIncludedIds = includedIds.length > 0 ? includedIds : memberIds;
        const evenCents = distributeEvenly(amountCents, includedCount, 0);
        splitCents = memberIds.map((id) => {
          const idx = finalIncludedIds.indexOf(id);
          return idx >= 0 ? evenCents[idx] : 0;
        });
      } else if (splitType === "percentage") {
        if (customSplits.length !== memberIds.length) {
          return errorResponse("Please provide percentages for every group member.", 400);
        }
        const percentages = memberIds.map((id) => {
          const cs = customSplits.find((s) => String(s.user) === id);
          return cs ? Number(cs.value) : 0;
        });
        splitCents = distributeByPercentage(amountCents, percentages);
      } else {
        // exact — client sends display amounts, we convert to cents
        if (customSplits.length !== memberIds.length) {
          return errorResponse("Please provide exact amounts for every group member.", 400);
        }
        splitCents = memberIds.map((id) => {
          const cs = customSplits.find((s) => String(s.user) === id);
          return toCents(cs ? Number(cs.value) : 0, currency);
        });
        const { valid, diff } = validateExactSplits(amountCents, splitCents);
        if (!valid) {
          return errorResponse(
            `Exact splits sum to ${formatMoney(amountCents - diff, currency)} ` +
              `but expense is ${formatMoney(amountCents, currency)}. ` +
              `Difference: ${formatMoney(Math.abs(diff), currency)}`,
            400
          );
        }
      }
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Invalid split input.", 400);
    }

    // Server-side split validation
    const splitInputs = memberIds.map((id, i) => ({ userId: id, amountCents: splitCents[i] }));
    const validation = validateSplits(amountCents, splitInputs, splitType, currency);
    if (!validation.valid) {
      return errorResponse(`Invalid splits: ${validation.errors.join("; ")}`, 400);
    }

    const splits = memberIds.map((id, i) => ({ user: id, amount: splitCents[i] }));

    const expense = await Expense.create({
      group: groupId,
      description,
      amount: amountCents,
      category: category || "other",
      splitType,
      paidBy,
      createdBy: authUserId,
      splits,
      receiptUrl,
      currency,
    });

    // Invalidate balance cache
    await invalidateBalanceCache(groupId);

    // Audit log
    const actor = await User.findById(authUserId).select("name").lean() as any;
    const actorName = actor?.name ?? authUserId;

    await logAction({
      action: "expense.created",
      actorId: authUserId,
      actorName,
      groupId,
      resourceId: String(expense._id),
      after: { description, amount: amountCents, currency, splitType },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Notify each split participant (excluding the actor)
    for (const split of splits) {
      if (String(split.user) === authUserId) continue;
      await notify({
        userId:     String(split.user),
        type:       "expense_added",
        title:      "New expense added",
        body:       `${actorName} added "${description}" — your share: ${formatMoney(split.amount, currency)}`,
        groupId,
        actorName,
        amount:     split.amount,
        currency,
        resourceId: String(expense._id),
      });
    }

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "name email avatar avatarUrl")
      .populate("createdBy", "name email")
      .populate("splits.user", "name email avatar avatarUrl")
      .lean();

    return successResponse({ expense: populated }, 201);
  } catch (error: unknown) {
    logError('[expenses POST]', error);
    return errorResponse("Failed to create expense.", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) return unauthorizedResponse();

    const groupId = request.nextUrl.searchParams.get("groupId");
    if (!groupId) return errorResponse("groupId query param is required.", 400);

    const group = await loadGroupForMember(groupId, authUserId);
    if (group === null) return errorResponse("Group not found.", 404);
    if (group === undefined) return unauthorizedResponse();

    const expenses = await Expense.find({ group: groupId })
      .select("description amount paidBy isGuest guestName guestId guestShare splits splitType category createdAt receiptUrl createdBy currency")
      .populate("paidBy", "name email avatar avatarUrl")
      .populate("createdBy", "name email")
      .populate("splits.user", "name email avatar avatarUrl")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const shaped = expenses.map((e: any) => ({
      ...e,
      isGuest:   e.isGuest ?? false,
      guestName: e.guestName ?? null,
    }));

    return successResponse({ expenses: shaped });
  } catch {
    return errorResponse("Failed to fetch expenses.", 500);
  }
}
