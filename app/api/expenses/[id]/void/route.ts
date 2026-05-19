import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";
import { getUserRole } from "@/lib/group-permissions";
import { formatMoney } from "@/lib/money";

/**
 * POST /api/expenses/[id]/void
 *
 * Void an expense. Allowed for:
 *   - The user who created the expense
 *   - Group owner or group admin
 *
 * Body: { reason: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid expense id", 400);
    }

    // Parse reason
    let body: unknown;
    try { body = await request.json(); } catch {
      return errorResponse("reason is required", 400);
    }
    const reason = (body as any)?.reason;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return errorResponse("reason is required", 400);
    }

    // Fetch expense with splits populated
    const expense = await Expense.findById(id)
      .populate("splits.user", "name email _id")
      .populate("group", "name currency");
    if (!expense) return errorResponse("Expense not found", 404);
    if (expense.isVoided) return errorResponse("Expense is already voided", 409);

    const group = expense.group as any;
    const groupId = String(group._id ?? expense.group);

    // Fetch group members separately (lean) for permission check
    const groupDoc = await Group.findById(groupId).select("members").lean() as any;

    // Permission check: creator OR group owner/admin
    const isCreator = String(expense.createdBy) === String(userId);
    const userRole = getUserRole(groupDoc?.members ?? [], userId);
    const isGroupManager = userRole === "owner" || userRole === "admin";

    if (!isCreator && !isGroupManager) {
      return errorResponse("Forbidden — only the expense creator, group owner, or group admin can void this expense", 403);
    }

    // Void it
    expense.isVoided = true;
    expense.voidedAt = new Date();
    await expense.save();

    // Invalidate balance cache
    invalidateBalanceCache(groupId).catch((err) =>
      logError("[void expense] invalidateBalanceCache", err, { id, groupId })
    );

    // Audit log
    logAction({
      action: "expense.voided",
      actorId: userId,
      actorName: userId,
      groupId,
      resourceId: id,
      before: { description: expense.description, amount: expense.amount },
      after: { reason: reason.trim(), voidedAt: expense.voidedAt },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    }).catch((err) => logError("[void expense] logAction", err, { id }));

    // Notify split participants (except the actor)
    const currency: string = group.currency ?? "USD";
    for (const split of expense.splits as any[]) {
      const splitUserId = String(split.user?._id ?? split.user);
      if (splitUserId === userId) continue;
      notify({
        userId: splitUserId,
        type: "expense_deleted",
        title: "Expense voided",
        body: `"${expense.description}" (${formatMoney(expense.amount, currency)}) was voided in ${group.name ?? "your group"}.`,
        groupId,
        resourceId: id,
      }).catch((err) => logError("[void expense] notify", err, { id, splitUserId }));
    }

    return successResponse({ voided: true, voidedAt: expense.voidedAt });
  } catch (err) {
    logError("[void expense POST]", err);
    return errorResponse("Failed to void expense", 500);
  }
}
