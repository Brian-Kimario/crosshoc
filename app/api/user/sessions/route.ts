import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import {
  verifyAuth,
  getTokenFromRequest,
  verifyToken,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/auth";
import { logError } from "@/lib/logger";

// GET /api/user/sessions — return the authenticated user's active sessions
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // Decode JWT to get the current sessionId
    const token = getTokenFromRequest(request);
    const decoded = token ? verifyToken(token) : null;
    const currentSessionId = decoded?.sessionId ?? null;

    const user = await User.findById(userId).select("sessions");
    if (!user) {
      return unauthorizedResponse();
    }

    // Map sessions, adding isCurrent flag
    const sessions = (user.sessions ?? []).map((s: any) => ({
      sessionId: s.sessionId,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent: s.sessionId === currentSessionId,
    }));

    // Sort: current session first, then by lastSeenAt descending
    sessions.sort((a: any, b: any) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });

    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    logError("[user sessions GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
