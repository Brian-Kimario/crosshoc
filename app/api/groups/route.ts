import crypto from "crypto";
import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";

function createInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const currency = ["USD", "INR", "TZS"].includes(body?.currency) ? body.currency : "USD";

    if (!name) {
      return errorResponse("Group name is required", 400);
    }

    const group = await Group.create({
      name,
      currency,
      creator: userId,
      members: [{ user: userId, shareRatio: 100 }],
      inviteToken: createInviteToken(),
      inviteExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
    });

    return successResponse(
      {
        group: {
          id: group._id,
          name: group.name,
          currency: group.currency,
          creator: group.creator,
          inviteToken: group.inviteToken,
          inviteExpiresAt: group.inviteExpiresAt,
          members: group.members,
        },
      },
      201
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return errorResponse("Could not generate unique invite token. Please retry.", 409);
    }

    return errorResponse("Failed to create group", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const groups = await Group.find({ "members.user": userId })
      .populate("creator", "name email avatar")
      .populate("members.user", "name email avatar")
      .sort({ createdAt: -1 });

    return successResponse({
      groups: groups.map((group) => ({
        id: group._id,
        name: group.name,
        currency: group.currency,
        creator: group.creator,
        members: group.members,
        inviteToken: group.inviteToken,
        inviteExpiresAt: group.inviteExpiresAt,
        createdAt: group.createdAt,
      })),
    });
  } catch {
    return errorResponse("Failed to fetch groups", 500);
  }
}
