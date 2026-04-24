import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await dbConnect();

    const { token } = await params;
    if (!token) {
      return errorResponse("Invite token is required", 400);
    }

    const group = await Group.findOne({ inviteToken: token }).select("name inviteExpiresAt currency");
    if (!group) {
      return errorResponse("Invitation not found", 404);
    }

    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invitation expired", 410);
    }

    return successResponse({
      group: {
        id: group._id,
        name: group.name,
        currency: (group as any).currency || 'USD',
      },
    });
  } catch {
    return errorResponse("Failed to validate invitation", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const { token } = await params;
    if (!token) {
      return errorResponse("Invite token is required", 400);
    }

    const group = await Group.findOne({ inviteToken: token }).populate("members.user", "name email avatar");
    if (!group) {
      return errorResponse("Invitation not found", 404);
    }

    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invitation expired", 410);
    }

    const existingMember = group.members.some(
      (member: { user: { _id: string } }) => String(member.user._id) === String(userId)
    );

    if (!existingMember) {
      group.members.push({
        user: userId,
        shareRatio: 100,
      });
      await group.save();
    }

    return successResponse({
      group: {
        id: group._id,
        name: group.name,
      },
    });
  } catch {
    return errorResponse("Failed to join group", 500);
  }
}
