import mongoose from "mongoose";
import { NextRequest } from "next/server";

import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  verifyAuth,
} from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import ExpenseComment from "@/lib/models/ExpenseComment";
import User from "@/lib/models/User";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";

/**
 * GET /api/expenses/[id]/comments
 * Returns all non-deleted comments for the expense, ordered by createdAt ascending.
 * Requirements: 11.2
 */
export async function GET(
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

    const expense = await Expense.findById(id).select("_id").lean();
    if (!expense) {
      return errorResponse("Expense not found", 404);
    }

    const comments = await ExpenseComment.find({
      expense: id,
      deletedAt: { $exists: false },
    })
      .sort({ createdAt: 1 })
      .lean();

    return successResponse({ comments });
  } catch (error: unknown) {
    logError("[expenses/comments GET]", error);
    return errorResponse("Failed to fetch comments", 500);
  }
}

/**
 * POST /api/expenses/[id]/comments
 * Creates a new comment on the expense.
 * Validates that `text` is non-empty and not whitespace-only.
 * If the commenter is not the expense payer, sends a notification to the payer.
 * Returns 201 with the created comment.
 * Requirements: 11.3, 11.6, 11.7
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

    const expense = await Expense.findById(id)
      .select("group paidBy description")
      .lean() as any;
    if (!expense) {
      return errorResponse("Expense not found", 404);
    }

    const body = await request.json().catch(() => ({}));
    const text: string = typeof body?.text === "string" ? body.text : "";

    // Validate text is non-empty and not whitespace-only (Requirement 11.7)
    if (!text.trim()) {
      return errorResponse("Comment text cannot be empty or whitespace only", 400);
    }

    // Look up the commenter's name from the User model
    const author = await User.findById(userId).select("name").lean() as any;
    const authorName: string = author?.name ?? "Unknown";

    const comment = await ExpenseComment.create({
      expense: new mongoose.Types.ObjectId(id),
      group: expense.group,
      author: new mongoose.Types.ObjectId(userId),
      authorName,
      isGuest: false,
      text: text.trim(),
      createdAt: new Date(),
    });

    // Notify the expense payer if the commenter is not the payer (Requirement 11.6)
    const payerId = expense.paidBy ? String(expense.paidBy) : null;
    if (payerId && payerId !== userId) {
      await notify({
        userId: payerId,
        type: "expense_added",
        title: "New comment on your expense",
        body: `${authorName} commented on "${expense.description}": ${text.trim()}`,
        groupId: expense.group ? String(expense.group) : undefined,
        actorName: authorName,
        resourceId: id,
      });
    }

    return successResponse({ comment }, 201);
  } catch (error: unknown) {
    logError("[expenses/comments POST]", error);
    return errorResponse("Failed to create comment", 500);
  }
}
