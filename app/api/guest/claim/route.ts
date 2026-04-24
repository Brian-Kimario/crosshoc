import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";
import GuestSession from "@/lib/models/GuestSession";

/**
 * POST /api/guest/claim
 * Migrates all expenses linked to a guestId to the authenticated user's permanent userId.
 * Also adds the user as a member to the group and marks the guest session as claimed.
 * Body: { guestId: string, groupId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const { guestId, groupId } = body;

    if (!guestId || typeof guestId !== "string") {
      return errorResponse("guestId is required", 400);
    }

    // 1. Migrate guest expenses to the real user
    const guestExpenses = await Expense.find({ guestId, isGuest: true });
    let migrated = 0;

    for (const expense of guestExpenses) {
      // Add the real user as a split participant (idempotent via $addToSet logic manually)
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const hasUserSplit = (expense.splits as Array<{ user: any }>).some(
        (s) => String(s.user) === String(userId)
      );

      if (!hasUserSplit) {
        // Find the guest's split to copy the amount
        const guestSplit = (expense.splits as Array<{ user: string; amount: number }>).find(
          (s) => s.user === guestId
        );
        if (guestSplit) {
          expense.splits.push({ user: userIdObj, amount: guestSplit.amount });
        }
      }

      // Update splits to replace guestId with userId where appropriate
      expense.splits = (expense.splits as Array<{ user: string | mongoose.Types.ObjectId; amount: number }>).map(
        (split) => {
          if (String(split.user) === guestId) {
            return { ...split, user: userIdObj };
          }
          return split;
        }
      );

      // If guest was the payer, update paidBy
      if (String(expense.paidBy) === guestId) {
        expense.paidBy = userIdObj;
      }

      expense.isGuest = false;
      expense.guestId = undefined;
      expense.guestName = undefined;
      await expense.save();
      migrated++;
    }

    // 2. If groupId provided, add user as member and mark guest session claimed
    let joinedGroup = false;
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      const group = await Group.findById(groupId);
      if (group) {
        const isMember = group.members.some(
          (m: { user: mongoose.Types.ObjectId }) => String(m.user) === String(userId)
        );
        if (!isMember) {
          group.members.push({ user: new mongoose.Types.ObjectId(userId), shareRatio: 100 });
          await group.save();
          joinedGroup = true;
        }

        // Mark guest session as claimed
        await GuestSession.findOneAndUpdate(
          { guestId, groupId: new mongoose.Types.ObjectId(groupId) },
          { claimedByUserId: new mongoose.Types.ObjectId(userId) }
        );
      }
    }

    return successResponse({
      migrated,
      joinedGroup,
      message: `Successfully claimed ${migrated} expense${migrated !== 1 ? "s" : ""}${joinedGroup ? " and joined the group" : ""}`,
    });
  } catch (err) {
    console.error("Guest claim error:", err);
    return errorResponse("Failed to claim guest expenses", 500);
  }
}
