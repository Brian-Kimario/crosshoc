import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import AuditLog from "@/lib/models/AuditLog";
import { sanitizeRegex } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const page    = parseInt(searchParams.get("page") ?? "1");
  const action  = searchParams.get("action") ?? "";
  const actor   = searchParams.get("actor")  ?? "";
  const from    = searchParams.get("from")   ?? "";
  const to      = searchParams.get("to")     ?? "";
  const groupId = searchParams.get("groupId") ?? "";

  // Export mode: no pagination, high limit
  const isExport    = searchParams.get("export") === "csv";
  const exportLimit = isExport
    ? Math.min(parseInt(searchParams.get("limit") ?? "5000"), 5000)
    : 50;
  const limit = exportLimit;
  const skip  = isExport ? 0 : (page - 1) * limit;

  const query: any = {};
  if (action)  query.action    = { $regex: sanitizeRegex(action), $options: "i" };
  if (actor)   query.actorName = { $regex: sanitizeRegex(actor),  $options: "i" };

  if (groupId) {
    try {
      query.groupId = new mongoose.Types.ObjectId(groupId);
    } catch {
      // Invalid ObjectId — ignore filter
    }
  }

  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to)   query.timestamp.$lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    isExport ? Promise.resolve(0) : AuditLog.countDocuments(query),
  ]);

  return NextResponse.json({ logs, total, page });
}
