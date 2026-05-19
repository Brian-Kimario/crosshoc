import { NextRequest } from "next/server";
import mongoose from "mongoose";

import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  verifyAuth,
} from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import { assertCan } from "@/lib/group-permissions";

const VALID_ROLES = ["owner", "admin", "member"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

function isValidRole(role: unknown): role is ValidRole {
  return typeof role === "string" && (VALID_ROLES as readonly string[]).includes(role);
}

/**
 * PATCH /api/groups/[id]/members
 * Change a member's role. Requires `changeRole` permission.
 * Returns 400 if the operation would demote the last owner.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const requestingUserId = await verifyAuth(request);
    if (!requestingUserId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    const body = await request.json();
    const { userId, role } = body;

    if (!userId || typeof userId !== "string") {
      return errorResponse("userId is required", 400);
    }
    if (!isValidRole(role)) {
      return errorResponse(
        `role must be one of: ${VALID_ROLES.join(", ")}`,
        400
      );
    }

    const group = await Group.findById(id);
    if (!group) {
      return errorResponse("Group not found", 404);
    }

    // Check requesting user has changeRole permission
    try {
      assertCan(group.members, requestingUserId, "changeRole");
    } catch (err: any) {
      return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
    }

    // Find the target member
    const targetMember = group.members.find(
      (m: { user: mongoose.Types.ObjectId }) => m.user.toString() === userId
    );
    if (!targetMember) {
      return errorResponse("Member not found in group", 404);
    }

    // Last-owner protection: if demoting the last owner, reject
    if (targetMember.role === "owner" && role !== "owner") {
      const ownerCount = group.members.filter(
        (m: { role: string }) => m.role === "owner"
      ).length;
      if (ownerCount <= 1) {
        return errorResponse(
          "Cannot change the role of the last owner. Assign another owner first.",
          400
        );
      }
    }

    // Apply the role change
    targetMember.role = role;
    await group.save();

    return successResponse({ members: group.members });
  } catch {
    return errorResponse("Failed to update member role", 500);
  }
}

/**
 * DELETE /api/groups/[id]/members
 * Remove a member from the group.
 * - Self-leave: no extra permission needed (beyond being a member).
 * - Remove other: requires `removeMember` permission.
 * Returns 400 if the operation would remove the last owner.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const requestingUserId = await verifyAuth(request);
    if (!requestingUserId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid group id", 400);
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return errorResponse("userId is required", 400);
    }

    const group = await Group.findById(id);
    if (!group) {
      return errorResponse("Group not found", 404);
    }

    const isSelfLeave = userId === requestingUserId;

    if (isSelfLeave) {
      // Self-leave: requesting user must be a member of the group
      const isMember = group.members.some(
        (m: { user: mongoose.Types.ObjectId }) =>
          m.user.toString() === requestingUserId
      );
      if (!isMember) {
        return errorResponse("You are not a member of this group", 403);
      }
    } else {
      // Removing another user: requires removeMember permission
      try {
        assertCan(group.members, requestingUserId, "removeMember");
      } catch (err: any) {
        return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
      }
    }

    // Find the target member
    const targetMember = group.members.find(
      (m: { user: mongoose.Types.ObjectId }) => m.user.toString() === userId
    );
    if (!targetMember) {
      return errorResponse("Member not found in group", 404);
    }

    // Last-owner protection
    if (targetMember.role === "owner") {
      const ownerCount = group.members.filter(
        (m: { role: string }) => m.role === "owner"
      ).length;
      if (ownerCount <= 1) {
        return errorResponse(
          "Cannot remove the last owner from the group. Assign another owner first.",
          400
        );
      }
    }

    // Remove the member
    group.members = group.members.filter(
      (m: { user: mongoose.Types.ObjectId }) => m.user.toString() !== userId
    );
    await group.save();

    return successResponse({ members: group.members });
  } catch {
    return errorResponse("Failed to remove member", 500);
  }
}
