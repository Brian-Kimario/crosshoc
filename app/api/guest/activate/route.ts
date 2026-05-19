import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import { validateInviteToken } from "@/lib/invites";
import GuestSession from "@/lib/models/GuestSession";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { parseBody, GuestActivateSchema } from "@/lib/validations";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const rateLimitResult = await checkRateLimit(req, "auth");
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    await dbConnect();

    const parsed = parseBody(GuestActivateSchema, await req.json());
    if (!parsed.success) {
      return parsed.response;
    }
    const { token, displayName } = parsed.data;

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
  } catch (error) {
    logError("[guest activate]", error);
    return NextResponse.json(
      { error: "Failed to activate guest session" },
      { status: 500 }
    );
  }
}
