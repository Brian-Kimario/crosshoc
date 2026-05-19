import { NextRequest } from "next/server";
import mongoose from "mongoose";

import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  verifyAuth,
} from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import RecurringExpense from "@/lib/models/RecurringExpense";
import { assertCan } from "@/lib/group-permissions";

/**
 * DELETE /api/groups/[id]/recurring/[recurringId]
 * Stops a recurring expense by setting isActive to false.
 * Requires `manageRecurring` permission.
 * Returns 200 with { recurringExpense: { isActive: false } }.
 * Requirements: 9.4, 9.5
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recurringId: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const { id, recurringId } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(recurringId)) {
      return errorResponse("Invalid recurring expense id", 400);
    }

    const group = await Group.findById(id);
    if (!group) {
      return errorResponse("Group not found", 404);
    }

    // Check requesting user has manageRecurring permission
    try {
      assertCan(group.members, userId, "manageRecurring");
    } catch (err: any) {
      return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
    }

    const recurringExpense = await RecurringExpense.findOne({
      _id: recurringId,
      group: id,
    });

    if (!recurringExpense) {
      return errorResponse("Recurring expense not found", 404);
    }

    recurringExpense.isActive = false;
    await recurringExpense.save();

    return successResponse({ recurringExpense: { isActive: false } });
  } catch {
    return errorResponse("Failed to stop recurring expense", 500);
  }
}
