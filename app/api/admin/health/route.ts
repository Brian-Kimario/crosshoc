import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import mongoose from "mongoose";
import { getActiveConnectionCount } from "@/lib/notification-stream";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1 ? "connected" :
    dbState === 2 ? "connecting" :
    dbState === 3 ? "disconnecting" :
    "disconnected";

  let dbPingMs: number | null = null;
  try {
    const start = Date.now();
    await mongoose.connection.db?.admin().ping();
    dbPingMs = Date.now() - start;
  } catch {
    dbPingMs = null;
  }

  const activeSSEConnections = getActiveConnectionCount();

  const memUsage = process.memoryUsage();

  return NextResponse.json({
    status:   dbStatus === "connected" ? "healthy" : "degraded",
    database: {
      status:  dbStatus,
      pingMs:  dbPingMs,
    },
    realtime: {
      activeSSEConnections,
    },
    memory: {
      heapUsedMB:  Math.round(memUsage.heapUsed  / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB:       Math.round(memUsage.rss       / 1024 / 1024),
    },
    uptime: {
      seconds: Math.floor(process.uptime()),
    },
    timestamp: new Date().toISOString(),
  });
}
