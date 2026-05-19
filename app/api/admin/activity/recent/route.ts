import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import AuditLog from "@/lib/models/AuditLog";

/**
 * GET /api/admin/activity/recent
 *
 * Returns audit log entries created after a given timestamp.
 * Used by the Live Activity page for efficient incremental polling.
 *
 * Query params:
 *   since: ISO timestamp (default: 5 minutes ago)
 *   limit: max entries (default: 50, max: 100)
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const sinceParam = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  // Default: last 5 minutes
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 5 * 60 * 1000);

  const logs = await AuditLog.find({
    timestamp: { $gt: since },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  const serverTime = new Date().toISOString();

  return NextResponse.json({
    logs,
    count: logs.length,
    since: since.toISOString(),
    serverTime, // client uses this as the next "since" value
  });
}
