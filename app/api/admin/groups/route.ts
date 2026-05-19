import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import { sanitizeRegex } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = 20;

  const query: any = {};
  if (search) {
    const safeSearch = sanitizeRegex(search);
    query.name = { $regex: safeSearch, $options: "i" };
  }

  const [groups, total] = await Promise.all([
    Group.find(query)
      .select("name members currency createdAt")
      .populate("members.user", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Group.countDocuments(query),
  ]);

  // Get total spending per group
  const groupIds = groups.map((g: any) => g._id);
  const spending = await Expense.aggregate([
    { $match: { group: { $in: groupIds } } },
    { $group: {
      _id:   "$group",
      total: { $sum: "$amount" },
      count: { $sum: 1 },
    }},
  ]);
  const spendMap: Record<string, { total: number; count: number }> = {};
  spending.forEach((s: any) => {
    spendMap[s._id.toString()] = {
      total: s.total,
      count: s.count,
    };
  });

  const enriched = groups.map((g: any) => ({
    _id:          g._id.toString(),
    name:         g.name,
    currency:     g.currency ?? "USD",
    memberCount:  (g.members ?? []).length,
    expenseCount: spendMap[g._id.toString()]?.count ?? 0,
    totalSpent:   spendMap[g._id.toString()]?.total ?? 0,
    createdAt:    g.createdAt,
    members:      (g.members ?? []).map((m: any) => ({
      name:  m.user?.name,
      email: m.user?.email,
    })),
  }));

  return NextResponse.json({ groups: enriched, total });
}
