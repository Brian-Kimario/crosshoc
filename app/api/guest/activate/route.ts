import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { validateInviteToken } from "@/lib/invites";
import GuestSession from "@/lib/models/GuestSession";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { token, displayName } = await req.json();

    if (!token || !displayName?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await validateInviteToken(token);
    if (!result.valid) {
      return NextResponse.json(
        { error: "This invite link has expired or is invalid." },
        { status: 410 }
      );
    }

    const guestId = crypto.randomUUID();
    const now = new Date();
    const sessionExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await GuestSession.create({
      guestId,
      displayName: displayName.trim(),
      groupId: result.invite!.groupId,
      inviteToken: token,
      activatedAt: now,
      expiresAt: sessionExpiry,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("guestId", guestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Failed to activate guest session" },
      { status: 500 }
    );
  }
}
