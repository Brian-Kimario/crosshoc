import { NextRequest } from "next/server";
import { verifyAuth, errorResponse, successResponse, unauthorizedResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import { createInviteToken, buildInviteUrl } from "@/lib/invites";
import mongoose from "mongoose";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const userId = await verifyAuth(req);
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    const group = await Group.findById(id);
    if (!group) return errorResponse("Group not found", 404);

    const isMember = group.members.some(
      (m: { user: mongoose.Types.ObjectId }) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return errorResponse("Forbidden — only group members can generate invite links", 403);
    }

    const { multiUse = true } = await req.json().catch(() => ({}));
    const token = await createInviteToken(id, userId, multiUse);
    const url = buildInviteUrl(token);

    return successResponse({
      url,
      token,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    });
  } catch {
    return errorResponse("Failed to generate invite link", 500);
  }
}
