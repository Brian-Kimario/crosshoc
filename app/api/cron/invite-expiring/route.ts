import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import InviteToken from "@/lib/models/InviteToken";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import { sendEmail } from "@/lib/email";
import InviteExpiringSoonEmail from "@/emails/InviteExpiringSoonEmail";
import React from "react";

/**
 * GET /api/cron/invite-expiring
 * Called by Vercel Cron every hour.
 * Finds InviteTokens expiring within 6 hours (and not yet notified) and
 * emails the token creator.
 *
 * Vercel cron config (vercel.json):
 *   { "path": "/api/cron/invite-expiring", "schedule": "0 * * * *" }
 *
 * Protected by Authorization: Bearer <CRON_SECRET> header.
 */
export async function GET(request: NextRequest) {
  // 1. Verify Authorization header
  if (
    request.headers.get("authorization") !==
    "Bearer " + process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const now = new Date();
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  // 2. Query InviteTokens expiring within 6 hours that haven't been notified yet
  const tokens = await InviteToken.find({
    expiresAt: { $gt: now, $lte: in6h },
    expiringSoonEmailSentAt: null,
  }).lean() as Array<{
    _id: unknown;
    groupId: unknown;
    createdBy: unknown;
    expiresAt: Date;
  }>;

  let processed = 0;

  for (const token of tokens) {
    try {
      // 3a. Fetch the group to get its name
      const group = await Group.findById(token.groupId).select("name _id").lean() as {
        _id: unknown;
        name: string;
      } | null;

      if (!group) continue;

      // 3b. Fetch the creator user to get email and name
      const creator = await User.findById(token.createdBy).select("email name _id").lean() as {
        _id: unknown;
        email: string;
        name: string;
      } | null;

      if (!creator) continue;

      const hoursRemaining = Math.floor(
        (token.expiresAt.getTime() - now.getTime()) / 3_600_000
      );

      const groupUrl =
        (process.env.NEXT_PUBLIC_APP_URL ?? "") + "/groups/" + String(group._id);

      // 3c. Fire-and-forget email
      sendEmail({
        to: creator.email,
        subject: `Your invite link for "${group.name}" is expiring soon`,
        react: React.createElement(InviteExpiringSoonEmail, {
          name: creator.name,
          groupName: group.name,
          hoursRemaining,
          groupUrl,
        }),
        prefsKey: "inviteExpiringSoon",
        userId: String(creator._id),
      });

      // 3d. Mark token as notified
      await InviteToken.findByIdAndUpdate(token._id, {
        expiringSoonEmailSentAt: new Date(),
      });

      processed++;
    } catch (err) {
      // Continue processing remaining tokens on per-token errors
      console.error("[cron/invite-expiring] Error processing token:", token._id, err);
    }
  }

  return NextResponse.json({ processed });
}
