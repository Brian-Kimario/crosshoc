import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import mongoose from "mongoose";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const userId = await verifyAuth(req);
  if (!userId) {
    return NextResponse.json({ groups: [], expenses: [] });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json({ groups: [], expenses: [] });
  }

  await dbConnect();
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const regex = new RegExp(q, "i");

  try {
    const [groups, expenses] = await Promise.all([
      // Search groups where user is a member
      Group.find({
        "members.user": userObjectId,
        name: regex,
      })
        .select("name members expenses currency")
        .lean()
        .limit(5),

      // Search expenses where user is involved
      Expense.find({
        description: regex,
        $or: [
          { "splits.user": userObjectId },
          { paidBy: userObjectId },
          { createdBy: userObjectId },
        ],
      })
        .select("description amount group currency")
        .populate("group", "name currency _id")
        .lean()
        .limit(5),
    ]);

    return NextResponse.json({
      groups: groups.map((g: any) => ({
        _id: g._id.toString(),
        name: g.name,
        memberCount: (g.members ?? []).length,
        expenseCount: (g.expenses ?? []).length,
        currency: g.currency,
      })),
      expenses: expenses.map((e: any) => ({
        _id: e._id.toString(),
        description: e.description,
        amount: e.amount,
        currency: (e.group as any)?.currency ?? e.currency ?? "USD",
        groupId: (e.group as any)?._id?.toString(),
        groupName: (e.group as any)?.name ?? "",
      })),
    });
  } catch (error) {
    logError('[search GET]', error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
