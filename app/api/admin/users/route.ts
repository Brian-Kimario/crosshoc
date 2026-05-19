import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Group from "@/lib/models/Group";
import { sanitizeRegex } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search") ?? "";
  const page     = parseInt(searchParams.get("page") ?? "1");
  const limit    = 20;
  const sortBy   = searchParams.get("sort") ?? "createdAt";
  const order    = searchParams.get("order") === "asc" ? 1 : -1;

  const query: any = {};
  if (search) {
    const safeSearch = sanitizeRegex(search);
    query.$or = [
      { email: { $regex: safeSearch, $options: "i" } },
      { name:  { $regex: safeSearch, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select("name email isAdmin isDisabled createdAt")
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  // Enrich with group count per user
  const userIds = users.map((u: any) => u._id);
  const groupCounts = await Group.aggregate([
    { $match: { "members.user": { $in: userIds } } },
    { $unwind: "$members" },
    { $match: { "members.user": { $in: userIds } } },
    { $group: { _id: "$members.user", count: { $sum: 1 } } },
  ]);
  const groupCountMap: Record<string, number> = {};
  groupCounts.forEach((g: any) => {
    groupCountMap[g._id.toString()] = g.count;
  });

  const enriched = users.map((u: any) => ({
    _id:        u._id.toString(),
    name:       u.name,
    email:      u.email,
    isAdmin:    u.isAdmin ?? false,
    isDisabled: u.isDisabled ?? false,
    createdAt:  u.createdAt,
    groupCount: groupCountMap[u._id.toString()] ?? 0,
  }));

  return NextResponse.json({ users: enriched, total, page });
}
