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

// DELETE /api/user/sessions/all — revoke all sessions except the current one
export async function DELETE(request: NextRequest) {
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

    // Fetch the user's sessions to find the current session object
    const user = await User.findById(userId).select("sessions");
    if (!user) {
      return unauthorizedResponse();
    }

    // Find the current session object to preserve it
    const currentSession = currentSessionId
      ? user.sessions?.find((s: any) => s.sessionId === currentSessionId) ?? null
      : null;

    // Replace sessions array with only the current session (or empty if not found)
    await User.findByIdAndUpdate(userId, {
      $set: { sessions: currentSession ? [currentSession] : [] },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("[user sessions all DELETE]", error);
    return errorResponse("Internal server error", 500);
  }
}
