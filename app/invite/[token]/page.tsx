import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { validateInviteToken, consumeToken } from "@/lib/invites";
import GuestSession from "@/lib/models/GuestSession";
import Group from "@/lib/models/Group";
import mongoose from "mongoose";
import GuestLandingClient from "./GuestLandingClient";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  await dbConnect();
  const { token } = await params;

  const result = await validateInviteToken(token);

  if (!result.valid) {
    redirect(`/invite/expired?reason=${result.reason}`);
  }

  const invite = result.invite!;
  const group = await Group.findById(invite.groupId)
    .populate("creator", "name")
    .lean();

  if (!group) redirect("/");

  // Check if user is logged in (via JWT token)
  const cookieStore = await cookies();
  const authToken = cookieStore.get("authToken")?.value;
  const decoded = authToken ? verifyToken(authToken) : null;

  // SCENARIO A: Logged-in user — add as full member, redirect
  if (decoded?.userId) {
    const userId = decoded.userId;

    // Check if already a member
    const isAlreadyMember = (group.members as Array<{ user: mongoose.Types.ObjectId }>).some(
      (m) => String(m.user) === String(userId)
    );

    if (!isAlreadyMember) {
      await Group.findByIdAndUpdate(invite.groupId, {
        $addToSet: { members: { user: new mongoose.Types.ObjectId(userId), shareRatio: 100 } },
      });
    }

    // Consume token if single-use
    if (!invite.multiUse) {
      await consumeToken(token);
    }

    redirect(`/groups/${invite.groupId}`);
  }

  // SCENARIO B: Existing guest cookie for this group
  const existingGuestId = cookieStore.get("guestId")?.value;
  if (existingGuestId) {
    const existingSession = await GuestSession.findOne({
      guestId: existingGuestId,
      groupId: invite.groupId,
      expiresAt: { $gt: new Date() },
    });

    if (existingSession) {
      redirect(`/invite/${token}/dashboard`);
    }
  }

  // SCENARIO C: New guest — render name-capture screen
  const inviterName = (group.creator as any)?.name || "Someone";

  return (
    <GuestLandingClient
      token={token}
      groupName={group.name}
      inviterName={inviterName}
    />
  );
}
