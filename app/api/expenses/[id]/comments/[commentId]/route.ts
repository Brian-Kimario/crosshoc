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
import Group from "@/lib/models/Group";
import { assertCan } from "@/lib/group-permissions";
import { logError } from "@/lib/logger";

/**
 * DELETE /api/expenses/[id]/comments/[commentId]
 * Soft-deletes a comment by setting `deletedAt` to the current time.
 *
 * Authorization: the requesting user must be the comment author OR have the
 * `deleteAnyComment` permission in the expense's group.
 *
 * Returns 200 with `{ comment: { deletedAt } }` on success.
 * Requirements: 11.4, 11.5
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id, commentId } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid expense id", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return errorResponse("Invalid comment id", 400);
    }

    // Load the comment
    const comment = await ExpenseComment.findById(commentId).lean() as any;
    if (!comment) {
      return errorResponse("Comment not found", 404);
    }

    // Ensure the comment belongs to the specified expense
    if (String(comment.expense) !== id) {
      return errorResponse("Comment not found", 404);
    }

    // Already deleted
    if (comment.deletedAt) {
      return errorResponse("Comment already deleted", 404);
    }

    // Load the expense to get the group
    const expense = await Expense.findById(id).select("group").lean() as any;
    if (!expense) {
      return errorResponse("Expense not found", 404);
    }

    // Check authorization: author OR has deleteAnyComment permission
    const isAuthor = comment.author && String(comment.author) === userId;

    if (!isAuthor) {
      // Must have deleteAnyComment permission in the group
      const group = await Group.findById(expense.group).select("members").lean() as any;
      if (!group) {
        return errorResponse("Group not found", 404);
      }

      try {
        assertCan(group.members, userId, "deleteAnyComment");
      } catch (err: any) {
        if (err?.status === 403) {
          return errorResponse("Forbidden: insufficient permissions", 403);
        }
        throw err;
      }
    }

    // Soft-delete the comment
    const deletedAt = new Date();
    await ExpenseComment.findByIdAndUpdate(commentId, { deletedAt });

    return successResponse({ comment: { deletedAt } });
  } catch (error: unknown) {
    logError("[expenses/comments DELETE]", error);
    return errorResponse("Failed to delete comment", 500);
  }
}
