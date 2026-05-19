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
import User from "@/lib/models/User";
import { assertCan } from "@/lib/group-permissions";
import { logAction } from "@/lib/audit";

/**
 * POST /api/groups/[id]/archive
 * Archive a group. Requires `archiveGroup` permission.
 * If the group has unsettled balances, includes a warning in the response
 * but still completes the archive operation.
 * Returns 200 with the updated group fields.
 */
export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const archiveNote: string | undefined =
      typeof body?.archiveNote === "string" ? body.archiveNote : undefined;

    const group = await Group.findById(id);
    if (!group) {
      return errorResponse("Group not found", 404);
    }

    // Check requesting user has archiveGroup permission
    try {
      assertCan(group.members, userId, "archiveGroup");
    } catch (err: any) {
      return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
    }

    // Check for unsettled balances
    let warning: string | undefined;
    const balances = group.cachedBalances?.data ?? [];
    const hasUnsettledBalances = balances.some(
      (entry: { balanceCents: number }) => entry.balanceCents !== 0
    );
    if (hasUnsettledBalances) {
      warning = "Group has unsettled balances";
    }

    // Archive the group
    group.status = "archived";
    group.archivedAt = new Date();
    group.archivedBy = new mongoose.Types.ObjectId(userId);
    if (archiveNote !== undefined) {
      group.archiveNote = archiveNote;
    }
    await group.save();

    // Fetch actor name for audit log
    const actor = await User.findById(userId).select("name").lean();
    const actorName = (actor as any)?.name ?? "Unknown";

    await logAction({
      action: "group.archived",
      actorId: userId,
      actorName,
      groupId: id,
      resourceId: id,
      before: { status: "active" },
      after: {
        status: "archived",
        archiveNote: archiveNote ?? "",
        archivedAt: group.archivedAt?.toISOString(),
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    const responseBody: Record<string, unknown> = {
      group: {
        status: group.status,
        archivedAt: group.archivedAt,
        archivedBy: group.archivedBy,
        archiveNote: group.archiveNote,
      },
    };
    if (warning) {
      responseBody.warning = warning;
    }

    return successResponse(responseBody);
  } catch {
    return errorResponse("Failed to archive group", 500);
  }
}

/**
 * DELETE /api/groups/[id]/archive
 * Restore an archived group. Requires `archiveGroup` permission.
 * Clears archivedAt, archivedBy, and archiveNote; sets status back to "active".
 * Returns 200 with the updated group status.
 */
export async function DELETE(
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

    const group = await Group.findById(id);
    if (!group) {
      return errorResponse("Group not found", 404);
    }

    // Check requesting user has archiveGroup permission
    try {
      assertCan(group.members, userId, "archiveGroup");
    } catch (err: any) {
      return errorResponse(err.message ?? "Forbidden", err.status ?? 403);
    }

    // Restore the group using $set/$unset to cleanly clear archive fields
    await Group.updateOne(
      { _id: group._id },
      {
        $set: { status: "active" },
        $unset: { archivedAt: "", archivedBy: "", archiveNote: "" },
      }
    );

    // Fetch actor name for audit log
    const actor = await User.findById(userId).select("name").lean();
    const actorName = (actor as any)?.name ?? "Unknown";

    await logAction({
      action: "group.restored",
      actorId: userId,
      actorName,
      groupId: id,
      resourceId: id,
      before: { status: "archived" },
      after: { status: "active", restoredAt: new Date().toISOString() },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return successResponse({ group: { status: "active" } });
  } catch {
    return errorResponse("Failed to restore group", 500);
  }
}
