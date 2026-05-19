import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { logError } from "@/lib/logger";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import { notify } from "@/lib/notify";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

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

    const rateLimitResult = await checkRateLimit(request, 'mutation');
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const { token } = await params;
    if (!token) {
      return errorResponse("Invite token is required", 400);
    }

    const group = await Group.findOne({ inviteToken: token }).populate("members.user", "name email avatar avatarUrl");
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
        role: "member",
        joinedAt: new Date(),
      });
      await group.save();

      // Notify the group creator that a new member joined
      const joiner = await User.findById(userId).select("name").lean() as any;
      const joinerName = joiner?.name ?? "Someone";

      await notify({
        userId:    String(group.creator),
        type:      "member_joined",
        title:     "New member joined",
        body:      `${joinerName} joined ${group.name}`,
        groupId:   String(group._id),
        actorName: joinerName,
      });
    }

    return successResponse({
      group: {
        id: group._id,
        name: group.name,
      },
    });
  } catch (error) {
    logError('[join group POST]', error);
    return errorResponse("Failed to join group", 500);
  }
}
