/**
 * app/api/user/change-password/route.ts — Password change
 *
 * POST /api/user/change-password — Change the authenticated user's password
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
import { logError } from "@/lib/logger";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(128, "New password must be at most 128 characters"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

// ─── POST /api/user/change-password ──────────────────────────────────────────

/**
 * Change the authenticated user's password.
 *
 * Flow:
 * 1. Rate-limit check (auth preset: 5 req/min)
 * 2. Authenticate via verifyAuth
 * 3. Validate request body with Zod
 * 4. Fetch user with password field selected
 * 5. Verify currentPassword against stored hash
 * 6. Hash newPassword with bcrypt (cost 12)
 * 7. Atomically update: set new password, clear sessions, increment tokenVersion
 * 8. Clear authToken cookie in response
 * 9. Return success message
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

    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return errorResponse(message, 400);
    }

    const { currentPassword, newPassword } = parsed.data;

    // 4. Fetch user with password field (select: false by default)
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return unauthorizedResponse();
    }

    // 5. Verify current password
    const isMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!isMatch) {
      return errorResponse("Current password is incorrect", 400);
    }

    // 6. Hash the new password (cost factor 12)
    const newHash = await bcryptjs.hash(newPassword, 12);

    // 7. Atomically update: new password, clear all sessions, increment tokenVersion
    await User.findByIdAndUpdate(userId, {
      $set: { password: newHash, sessions: [] },
      $inc: { tokenVersion: 1 },
    });

    // 8. Build response and clear the authToken cookie
    const response = NextResponse.json(
      {
        success: true,
        message: "Password changed. You have been signed out of all devices.",
      },
      { status: 200 }
    );

    response.cookies.set("authToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error: any) {
    logError("[user change-password POST]", error);
    return errorResponse("Internal server error", 500);
  }
}
