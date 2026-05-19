import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";

/**
 * GET /api/admin/settlements
 * Returns all settlements with optional status filter and pagination.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "pending" | "confirmed" | "disputed" | all
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 50;

  const query: Record<string, unknown> = {};
  if (status && ["pending", "confirmed", "disputed"].includes(status)) {
    query.status = status;
  }

  const [settlements, total, counts] = await Promise.all([
    Settlement.find(query)
      .select("fromUser toUser amount method note status proofUrl settledAt createdAt group disputeReason")
      .populate("fromUser", "name email")
      .populate("toUser",   "name email")
      .populate("group",    "name currency")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Settlement.countDocuments(query),
    Settlement.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts: Record<string, number> = { pending: 0, confirmed: 0, disputed: 0 };
  counts.forEach((c: any) => { statusCounts[c._id] = c.count; });

  return NextResponse.json({ settlements, total, page, statusCounts });
}
