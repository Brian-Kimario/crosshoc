import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    const group = await Group.findById(id)
      .populate("creator", "name email avatar")
      .populate("members.user", "name email avatar");

    if (!group) {
      return errorResponse("Group not found", 404);
    }

    const isMember = group.members.some((member: { user: { _id: mongoose.Types.ObjectId } }) =>
      String(member.user._id) === String(userId)
    );
    if (!isMember) {
      return unauthorizedResponse();
    }

    return successResponse({
      group: {
        id: group._id,
        name: group.name,
        currency: (group as any).currency || 'USD',
        creator: group.creator,
        members: group.members,
        inviteToken: group.inviteToken,
        inviteExpiresAt: group.inviteExpiresAt,
        createdAt: group.createdAt,
      },
    });
  } catch {
    return errorResponse("Failed to fetch group", 500);
  }
}
