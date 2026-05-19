import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import Settlement from "@/lib/models/Settlement";
import { fromCents } from "@/lib/money";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const userId = await verifyAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch all groups the user belongs to
    const groups = await Group.find({ "members.user": userObjectId })
      .select("name description members currency createdAt updatedAt")
      .populate("members.user", "name email avatarUrl")
      .lean();

    const groupsWithData = await Promise.all(
      groups.map(async (group: any) => {
        const groupId = group._id;

        // Expense count
        const expenseCount = await Expense.countDocuments({ group: groupId });

        // Expenses for balance calculation
        const expenses = await Expense.find({ group: groupId })
          .select("amount paidBy splits isGuest")
          .populate("paidBy", "_id")
          .populate("splits.user", "_id")
          .lean();

        let paidCents = 0;
        let owedCents = 0;

        for (const expense of expenses as any[]) {
          // Skip guest-paid expenses for the registered user's balance
          // (guest expenses use paidBy: null — the balance engine handles them separately)
          if (expense.isGuest) continue;

          const paidById = expense.paidBy?._id?.toString();
          if (paidById === userId) {
            paidCents += expense.amount;
          }

          for (const split of expense.splits ?? []) {
            const splitUserId = split.user?._id?.toString();
            if (splitUserId === userId) {
              owedCents += split.amount;
            }
          }
        }

        // Only CONFIRMED settlements affect balance
        const settlements = await Settlement.find({
          group: groupId,
          status: "confirmed",
        })
          .select("fromUser toUser amount")
          .populate("fromUser", "_id")
          .populate("toUser", "_id")
          .lean();

        for (const settlement of settlements as any[]) {
          const fromId = settlement.fromUser?._id?.toString();
          const toId   = settlement.toUser?._id?.toString();

          if (fromId === userId) paidCents += settlement.amount;
          if (toId   === userId) owedCents += settlement.amount;
        }

        // Convert cents to display currency
        const currency: string = group.currency || "USD";
        const myBalance = fromCents(paidCents - owedCents, currency);

        return {
          _id: group._id.toString(),
          name: group.name || "Unnamed group",
          description: group.description || "",
          members: (group.members ?? []).map((m: any) => ({
            _id:       m.user?._id?.toString() ?? "",
            name:      m.user?.name      ?? "",
            email:     m.user?.email     ?? "",
            avatarUrl: m.user?.avatarUrl ?? null,
          })),
          expenseCount,
          myBalance,
          currency,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        };
      })
    );

    const totalOwedToMe = groupsWithData
      .filter((g) => g.myBalance > 0)
      .reduce((sum, g) => sum + g.myBalance, 0);

    const totalIOwe = groupsWithData
      .filter((g) => g.myBalance < 0)
      .reduce((sum, g) => sum + Math.abs(g.myBalance), 0);

    return NextResponse.json({
      groups: groupsWithData,
      totalOwedToMe: Number(totalOwedToMe.toFixed(2)),
      totalIOwe:     Number(totalIOwe.toFixed(2)),
    });
  } catch (err) {
    logError('[dashboard overview GET]', err);
    return NextResponse.json(
      { error: "Internal server error", groups: [], totalOwedToMe: 0, totalIOwe: 0 },
      { status: 500 }
    );
  }
}
