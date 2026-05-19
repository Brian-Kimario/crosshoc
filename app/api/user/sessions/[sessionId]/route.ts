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

// DELETE /api/user/sessions/[sessionId] — revoke a specific session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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

    const { sessionId: targetSessionId } = await params;

    // Prevent revoking the current session
    if (targetSessionId === currentSessionId) {
      return errorResponse("Cannot revoke the current session", 400);
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { sessions: { sessionId: targetSessionId } },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("[user sessions DELETE]", error);
    return errorResponse("Internal server error", 500);
  }
}
