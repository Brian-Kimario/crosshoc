import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import { logError } from "@/lib/logger";

const PAGE_LIMIT = 20;

/**
 * GET /api/expenses/mine
 * Returns all expenses the current user is involved in across every group.
 * Involvement = paidBy OR splits[].user.
 *
 * Query params:
 *   groupId  — filter to a single group
 *   search   — case-insensitive description search
 *   page     — 1-based page number (default 1)
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = request.nextUrl;
    const groupId = searchParams.get("groupId");
    const search  = searchParams.get("search");
    const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const query: Record<string, unknown> = {
      $or: [
        { paidBy: userObjectId },
        { "splits.user": userObjectId },
      ],
    };

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      query.group = new mongoose.Types.ObjectId(groupId);
    }
    if (search?.trim()) {
      query.description = { $regex: search.trim(), $options: "i" };
    }

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .select(
          "description amount category paidBy splits group createdAt receiptUrl isGuest guestName currency splitType"
        )
        .populate("paidBy", "name email avatarUrl")
        .populate("group", "name currency")
        .populate("splits.user", "name _id")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_LIMIT)
        .limit(PAGE_LIMIT)
        .lean(),
      Expense.countDocuments(query),
    ]);

    // Annotate each expense with the current user's relationship to it
    const annotated = expenses.map((exp: any) => {
      const paidById = exp.paidBy?._id?.toString();
      const isPayer  = paidById === userId;

      const userSplit = (exp.splits ?? []).find(
        (s: any) => s.user?._id?.toString() === userId
      );
      const myShareCents: number = userSplit?.amount ?? 0;

      // Status logic:
      // "you paid"  — you are the payer
      // "you owe"   — you have a split but didn't pay
      // "settled"   — you have no split (just visible because you're in the group)
      let status: "paid" | "owed" | "settled" = "settled";
      if (isPayer) {
        status = "paid";
      } else if (myShareCents > 0) {
        status = "owed";
      }

      return {
        _id:          exp._id,
        description:  exp.description,
        amount:       exp.amount,
        category:     exp.category,
        splitType:    exp.splitType,
        createdAt:    exp.createdAt,
        receiptUrl:   exp.receiptUrl,
        isGuest:      exp.isGuest ?? false,
        guestName:    exp.guestName ?? null,
        currency:     exp.currency ?? exp.group?.currency ?? "USD",
        group: {
          _id:      exp.group?._id,
          name:     exp.group?.name ?? "Unknown group",
          currency: exp.group?.currency ?? "USD",
        },
        paidBy: exp.paidBy
          ? { _id: exp.paidBy._id, name: exp.paidBy.name }
          : null,
        splits:       exp.splits ?? [],
        myShareCents,
        status,
      };
    });

    return successResponse({
      expenses: annotated,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / PAGE_LIMIT),
        hasMore: page * PAGE_LIMIT < total,
      },
    });
  } catch (err) {
    logError('[expenses mine GET]', err);
    return errorResponse("Failed to fetch expenses", 500);
  }
}
