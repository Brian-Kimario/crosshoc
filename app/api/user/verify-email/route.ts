/**
 * app/api/user/verify-email/route.ts — Email change verification
 *
 * GET /api/user/verify-email?token=<token> — Verify a pending email change
 * using the token sent to the new address. Applies the change, invalidates
 * all sessions, and redirects the user.
 *
 * Requirements: 7.6, 7.7, 7.8
 */

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logError } from "@/lib/logger";

// ─── GET /api/user/verify-email ───────────────────────────────────────────────

/**
 * Verify a pending email change token.
 *
 * Flow:
 * 1. Read `token` from query string
 * 2. Find user with matching non-expired pendingEmailToken
 * 3. If not found or expired: redirect to /settings?error=expired-token
 * 4. Apply email change atomically: set new email, clear pending fields,
 *    clear all sessions, increment tokenVersion
 * 5. Clear authToken cookie
 * 6. Redirect to /settings?success=email-changed
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Read token from query string
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/settings?error=expired-token", request.url)
      );
    }

    await dbConnect();

    // 2. Find user with matching non-expired token.
    // pendingEmailToken has select: false — must explicitly select it.
    const user = await User.findOne({
      pendingEmailToken: token,
      pendingEmailTokenExpiry: { $gt: new Date() },
    }).select("+pendingEmailToken +pendingEmailTokenExpiry +pendingEmail");

    // 3. If not found or expired: redirect with error
    if (!user) {
      return NextResponse.redirect(
        new URL("/settings?error=expired-token", request.url)
      );
    }

    // 4. Apply email change atomically:
    //    - Set email to pendingEmail
    //    - Clear all pending email fields
    //    - Clear all sessions (forces re-login on all devices)
    //    - Increment tokenVersion (invalidates all existing JWTs)
    await User.findByIdAndUpdate(user._id, {
      $set: {
        email: user.pendingEmail,
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailTokenExpiry: null,
        sessions: [],
      },
      $inc: { tokenVersion: 1 },
    });

    // 5. Build redirect response and clear the authToken cookie
    const redirectUrl = new URL("/settings?success=email-changed", request.url);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set("authToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    // 6. Redirect to settings with success message
    return response;
  } catch (error: any) {
    logError("[user verify-email GET]", error);
    // On unexpected error, redirect to settings with error param
    return NextResponse.redirect(
      new URL("/settings?error=expired-token", request.url)
    );
  }
}
