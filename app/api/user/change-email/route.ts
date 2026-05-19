/**
 * app/api/user/change-email/route.ts — Email change request
 *
 * POST /api/user/change-email — Initiate an email address change for the
 * authenticated user. Stores a pending email + verification token and sends
 * a verification link to the new address.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import {
  verifyAuth,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/auth";
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { VerifyEmailChangeEmail } from "@/emails/VerifyEmailChangeEmail";
import { logError } from "@/lib/logger";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const ChangeEmailSchema = z.object({
  newEmail: z
    .string()
    .email("Please provide a valid email address")
    .transform((v) => v.toLowerCase().trim()),
  currentPassword: z.string().min(1, "Current password is required"),
});

// ─── POST /api/user/change-email ─────────────────────────────────────────────

/**
 * Initiate an email address change.
 *
 * Flow:
 * 1. Rate-limit check (auth preset: 5 req/min)
 * 2. Authenticate via verifyAuth
 * 3. Validate request body with Zod
 * 4. Fetch user with password + email fields selected
 * 5. Verify currentPassword against stored hash
 * 6. Reject if newEmail === current email
 * 7. Reject if newEmail is already registered to another account
 * 8. Generate a 32-byte hex token and 24-hour expiry
 * 9. Store pendingEmail, pendingEmailToken, pendingEmailTokenExpiry on user
 * 10. Send verification email to newEmail (log URL in development)
 * 11. Return success
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Rate limit check
    const rateLimitResult = await checkRateLimit(request, "auth");
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    // 2. Auth check
    await dbConnect();
    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // 3. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsed = ChangeEmailSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return errorResponse(message, 400);
    }

    const { newEmail, currentPassword } = parsed.data;

    // 4. Fetch user with password field (select: false by default)
    const user = await User.findById(userId).select("+password email");
    if (!user) {
      return unauthorizedResponse();
    }

    // 5. Verify current password
    const isMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!isMatch) {
      return errorResponse("Password is incorrect", 400);
    }

    // 6. Reject if new email is the same as current email
    if (newEmail === user.email) {
      return errorResponse("New email must be different from current email", 400);
    }

    // 7. Reject if new email is already registered to another account
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return errorResponse("Email is already in use", 409);
    }

    // 8. Generate verification token and expiry (24 hours)
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 9. Store pending email change fields on user
    await User.findByIdAndUpdate(userId, {
      $set: {
        pendingEmail: newEmail,
        pendingEmailToken: token,
        pendingEmailTokenExpiry: expiry,
      },
    });

    // 10. Build verification URL and send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/api/user/verify-email?token=${token}`;

    // In development: log the URL for easy testing
    if (process.env.NODE_ENV === "development") {
      console.log("[change-email] Verification URL:", verifyUrl);
    }

    void sendEmail({
      to: newEmail,
      subject: "Verify your new SplitEasy email address",
      react: VerifyEmailChangeEmail({
        name: user.name,
        verifyUrl,
        newEmail,
        expiresInHours: 24,
      }),
    });

    // 11. Return success
    const responseBody: Record<string, unknown> = {
      success: true,
      message: "Verification email sent. Please check your inbox to confirm the change.",
    };

    // Include verifyUrl in development response for testing convenience
    if (process.env.NODE_ENV === "development") {
      responseBody.verifyUrl = verifyUrl;
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error: any) {
    logError("[user change-email POST]", error);
    return errorResponse("Internal server error", 500);
  }
}
