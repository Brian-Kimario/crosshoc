import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import { assertCan } from "@/lib/group-permissions";
import { logError } from "@/lib/logger";

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
      .populate("creator", "name email avatar avatarUrl")
      .populate("members.user", "name email avatar avatarUrl");

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
        description: (group as any).description ?? "",
        currency: (group as any).currency || 'USD',
        creator: group.creator,
        members: group.members,
        inviteToken: group.inviteToken,
        inviteExpiresAt: group.inviteExpiresAt,
        createdAt: group.createdAt,
        status: (group as any).status,
      },
    });
  } catch {
    return errorResponse("Failed to fetch group", 500);
  }
}

/**
 * PATCH /api/groups/[id]
 * Update group name and/or description.
 * Requires `editGroupSettings` permission (owner or admin).
 */
export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const { name, description } = body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return errorResponse("name must be a non-empty string", 400);
    }
    if (description !== undefined && typeof description !== "string") {
      return errorResponse("description must be a string", 400);
    }
    if (description !== undefined && description.length > 300) {
      return errorResponse("description must be 300 characters or fewer", 400);
    }

    const group = await Group.findById(id);
    if (!group) return errorResponse("Group not found", 404);

    try {
      assertCan(group.members, userId, "editGroupSettings");
    } catch (err: any) {
      return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
    }

    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) (group as any).description = description.trim();
    await group.save();

    return successResponse({
      group: {
        id: group._id,
        name: group.name,
        description: (group as any).description ?? "",
        currency: (group as any).currency,
      },
    });
  } catch (err) {
    logError("[groups PATCH]", err);
    return errorResponse("Failed to update group", 500);
  }
}

/**
 * DELETE /api/groups/[id]
 * Permanently delete a group and all its expenses/settlements.
 * Requires `deleteGroup` permission (owner only).
 */
export async function DELETE(
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

    try {
      assertCan(group.members, userId, "deleteGroup");
    } catch (err: any) {
      return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
    }

    // Delete related data
    const Expense = (await import("@/lib/models/Expense")).default;
    const Settlement = (await import("@/lib/models/Settlement")).default;
    await Promise.all([
      Expense.deleteMany({ group: id }),
      Settlement.deleteMany({ group: id }),
      Group.findByIdAndDelete(id),
    ]);

    return successResponse({ deleted: true });
  } catch (err) {
    logError("[groups DELETE]", err);
    return errorResponse("Failed to delete group", 500);
  }
}
