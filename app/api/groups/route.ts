import crypto from "crypto";
import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { logError } from "@/lib/logger";
import Group from "@/lib/models/Group";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { CreateGroupSchema, parseBody } from "@/lib/validations";

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

    const rateLimitResult = await checkRateLimit(request, "mutation");
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    const body = await request.json();
    const parsed = parseBody(CreateGroupSchema, body);
    if (!parsed.success) {
      return parsed.response;
    }

    const { name, currency = "USD" } = parsed.data;

    const group = await Group.create({
      name,
      currency,
      creator: userId,
      createdBy: userId,
      members: [{ user: userId, role: "owner", joinedAt: new Date() }],
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

    logError("[groups POST]", error);
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

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("archived") === "true";

    const query: Record<string, unknown> = { "members.user": userId };
    if (!includeArchived) {
      query.status = { $ne: "archived" };
    }

    const groups = await Group.find(query)
      .populate("creator", "name email avatar avatarUrl")
      .populate("members.user", "name email avatar avatarUrl")
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
        status: group.status,
        archivedAt: group.archivedAt,
      })),
    });
  } catch (error: unknown) {
    logError('[groups GET]', error);
    return errorResponse('Failed to fetch groups', 500);
  }
}
