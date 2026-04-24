import crypto from "crypto";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";

function createInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * POST /api/groups/[id]/refresh-invite
 * Regenerates the invite token and resets expiry to 72 hours from now.
 * Only the group creator can refresh the link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    const group = await Group.findById(id);
    if (!group) return errorResponse("Group not found", 404);

    if (String(group.creator) !== String(userId)) {
      return errorResponse("Only the group creator can refresh the invite link", 403);
    }

    group.inviteToken = createInviteToken();
    group.inviteExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await group.save();

    return successResponse({
      inviteToken: group.inviteToken,
      inviteExpiresAt: group.inviteExpiresAt,
    });
  } catch {
    return errorResponse("Failed to refresh invite link", 500);
  }
}
