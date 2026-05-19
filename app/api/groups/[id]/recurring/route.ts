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
 * GET /api/groups/[id]/recurring
 * Returns all active RecurringExpense documents for the group.
 * Requirements: 9.1
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    const group = await Group.findById(id);
    if (!group) {
      return errorResponse("Group not found", 404);
    }

    const recurringExpenses = await RecurringExpense.find({
      group: id,
      isActive: true,
    });

    return successResponse({ recurringExpenses });
  } catch {
    return errorResponse("Failed to fetch recurring expenses", 500);
  }
}

/**
 * POST /api/groups/[id]/recurring
 * Creates a new RecurringExpense document for the group.
 * Requires `manageRecurring` permission.
 * Validates that `amount` is a positive integer.
 * Returns 201 with the created recurringExpense.
 * Requirements: 9.2, 9.3, 9.6
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
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

    const body = await request.json().catch(() => ({}));

    // Validate amount is a positive integer (cents)
    const { amount } = body;
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return errorResponse("amount must be a positive integer (cents)", 400);
    }

    const recurringExpense = await RecurringExpense.create({
      ...body,
      group: id,
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    return successResponse({ recurringExpense }, 201);
  } catch (err: any) {
    // Surface Mongoose validation errors as 400
    if (err.name === "ValidationError") {
      const message = Object.values(err.errors)
        .map((e: any) => e.message)
        .join(", ");
      return errorResponse(message, 400);
    }
    return errorResponse("Failed to create recurring expense", 500);
  }
}
