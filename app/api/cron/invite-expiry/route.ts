import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import { notify } from "@/lib/notify";

/**
 * GET /api/cron/invite-expiry
 * Called by Vercel Cron every hour.
 * Finds invite tokens expiring within 6 hours and notifies the group creator.
 *
 * Vercel cron config (vercel.json):
 *   { "path": "/api/cron/invite-expiry", "schedule": "0 * * * *" }
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const now = new Date();
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  // Find groups whose invite token expires within 6 hours
  // and where we haven't sent a warning yet (tracked via inviteWarningSent flag)
  const groups = await Group.find({
    inviteExpiresAt: { $gt: now, $lte: in6h },
    inviteWarningSent: { $ne: true },
    inviteToken: { $ne: null },
  })
    .select("name creator inviteExpiresAt _id")
    .lean() as any[];

  let processed = 0;

  for (const group of groups) {
    const hoursLeft = Math.floor(
      (new Date(group.inviteExpiresAt).getTime() - now.getTime()) / 3_600_000
    );

    await notify({
      userId:   String(group.creator),
      type:     "invite_expiring",
      title:    "Invite link expiring soon",
      body:     `Your invite link for "${group.name}" expires in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}. Generate a new one from the group page.`,
      groupId:  String(group._id),
    });

    // Mark as warned so we don't send duplicate notifications
    await Group.findByIdAndUpdate(group._id, { inviteWarningSent: true });
    processed++;
  }

  return NextResponse.json({ processed });
}
