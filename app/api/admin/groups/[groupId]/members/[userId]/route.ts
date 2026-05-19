import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { RemovedFromGroupEmail } from "@/emails/RemovedFromGroupEmail";
import React from "react";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; userId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error) return error;

  // 2. DB connection
  await dbConnect();

  const { groupId, userId } = await params;

  try {
    // 3. Parse and validate reason
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const reason = (body as any)?.reason;
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    // 4. Fetch the Group document
    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // 5. Check that the target userId exists in group.members[]
    const memberEntry = group.members.find(
      (m: any) => m.user.toString() === userId
    );
    if (!memberEntry) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    // 6. Fetch the user's name and email before removing
    const targetUser = await User.findById(userId).select("name email").lean() as any;
    const memberName: string = targetUser?.name ?? userId;
    const memberEmail: string = targetUser?.email ?? "";

    // 7. Remove the member entry using $pull on Group.members
    await Group.updateOne(
      { _id: groupId },
      { $pull: { members: { user: memberEntry.user } } }
    );

    const resourceId = group._id.toString();

    // 8. Fire-and-forget: invalidate balance cache
    invalidateBalanceCache(groupId).catch((err) =>
      logError("[admin remove member] invalidateBalanceCache", err, {
        groupId,
        userId,
      })
    );

    // 9. Fire-and-forget: audit log
    logAction({
      action: "member.admin_removed",
      actorId: session!.userId,
      actorName: session!.name,
      groupId,
      resourceId,
      before: { userId, name: memberName },
      after: { reason: reason.trim(), groupId },
    }).catch((err) =>
      logError("[admin remove member] logAction", err, { groupId, userId })
    );

    // 10. Fire-and-forget: notify the removed user
    notify({
      userId,
      type: "expense_deleted",
      title: "Removed from group by admin",
      body: `You have been removed from the group "${group.name}" by an admin.`,
      groupId,
      resourceId,
    }).catch((err) =>
      logError("[admin remove member] notify", err, { groupId, userId })
    );

    // 11. Fire-and-forget: send RemovedFromGroupEmail
    if (memberEmail) {
      sendEmail({
        to: memberEmail,
        subject: `You have been removed from "${group.name}"`,
        react: React.createElement(RemovedFromGroupEmail, {
          name: memberName,
          groupName: group.name,
          reason: reason.trim() ?? "No reason provided",
          supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
        }),
        userId: userId,
        prefsKey: "removedFromGroup",
      }).catch((err) =>
        logError("[admin remove member] sendEmail", err, { groupId, userId })
      );
    }

    // 12. Return success
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("[admin remove member]", err, { groupId, userId });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
