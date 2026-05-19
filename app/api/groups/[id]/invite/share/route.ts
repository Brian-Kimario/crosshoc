import { NextRequest } from "next/server";
import {
  verifyAuth,
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from "@/lib/auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import InviteToken from "@/lib/models/InviteToken";
import { createInviteToken, buildInviteUrl } from "@/lib/invites";
import { sendEmail } from "@/lib/email";
import GroupInviteEmail from "@/emails/GroupInviteEmail";
import mongoose from "mongoose";
import React from "react";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(req);
    if (!userId) return unauthorizedResponse();

    const rateLimitResult = await checkRateLimit(req, "invite");
    if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult);

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    // Parse and validate request body
    let body: { recipientEmail?: unknown; recipientName?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { recipientEmail, recipientName } = body;

    if (!recipientEmail || typeof recipientEmail !== "string") {
      return errorResponse("recipientEmail is required", 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return errorResponse("recipientEmail must be a valid email address", 400);
    }

    // Fetch group and verify membership
    const group = await Group.findById(id);
    if (!group) return errorResponse("Group not found", 404);

    const isMember = group.members.some(
      (m: { user: mongoose.Types.ObjectId }) =>
        String(m.user) === String(userId)
    );
    if (!isMember) {
      return errorResponse(
        "Forbidden — only group members can send invite emails",
        403
      );
    }

    // Fetch the requesting user's name
    const user = await User.findById(userId).select("name");
    if (!user) return errorResponse("User not found", 404);

    // Get existing valid invite token for the group, or create one
    const now = new Date();
    let existingToken = await InviteToken.findOne({
      groupId: new mongoose.Types.ObjectId(id),
      expiresAt: { $gt: now },
    }).sort({ expiresAt: -1 });

    let tokenString: string;
    let expiresAt: Date;

    if (existingToken) {
      tokenString = existingToken.token;
      expiresAt = existingToken.expiresAt;
    } else {
      tokenString = await createInviteToken(id, userId, true);
      // Fetch the newly created token to get its expiresAt
      const newToken = await InviteToken.findOne({ token: tokenString });
      expiresAt = newToken
        ? newToken.expiresAt
        : new Date(now.getTime() + 72 * 60 * 60 * 1000);
    }

    const inviteUrl = buildInviteUrl(tokenString);

    // Fire-and-forget sendEmail
    void sendEmail({
      to: recipientEmail,
      subject: `${user.name} invited you to join ${group.name} on SplitEasy`,
      react: React.createElement(GroupInviteEmail, {
        recipientName:
          typeof recipientName === "string" ? recipientName : undefined,
        inviterName: user.name,
        groupName: group.name,
        inviteUrl,
        expiresAt: expiresAt.toISOString(),
      }),
      prefsKey: "groupInvite",
      userId: String(userId),
    });

    return successResponse({ success: true });
  } catch (error: unknown) {
    logError("[invite/share POST]", error);
    return errorResponse("Failed to send invite email", 500);
  }
}
