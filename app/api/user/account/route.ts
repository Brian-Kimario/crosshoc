/**
 * app/api/user/account/route.ts — Account deletion
 *
 * DELETE /api/user/account — Permanently delete the authenticated user's account
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import {
  verifyAuth,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/auth";
import { logError } from "@/lib/logger";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const DeleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmText: z.literal("DELETE MY ACCOUNT"),
});

// ─── Cloudinary configuration ─────────────────────────────────────────────────

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ─── DELETE /api/user/account ─────────────────────────────────────────────────

/**
 * Permanently delete the authenticated user's account.
 *
 * Flow:
 * 1. Authenticate via verifyAuth
 * 2. Validate request body with Zod (password + confirmText literal)
 * 3. Fetch user with password field selected
 * 4. Verify password against stored hash
 * 5. Remove user from all group members arrays
 * 6. Anonymize expenses where user was paidBy
 * 7. Delete the user document
 * 8. Attempt to destroy Cloudinary avatar (non-fatal)
 * 9. Clear authToken cookie
 * 10. Return { success: true }
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    await dbConnect();
    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsed = DeleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return errorResponse(message, 400);
    }

    const { password } = parsed.data;

    // 3. Fetch user with password field (select: false by default)
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return unauthorizedResponse();
    }

    // 4. Verify password against stored hash
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return errorResponse("Password is incorrect", 400);
    }

    // 5. Remove user from all groups (members is an array of { user, role, joinedAt } objects)
    await Group.updateMany(
      { "members.user": userId },
      { $pull: { members: { user: userId } } }
    );

    // 6. Anonymize expenses where this user was the payer
    await Expense.updateMany(
      { paidBy: userId },
      { $set: { paidBy: null, paidByDeleted: true } }
    );

    // 7. Delete the user document
    await User.findByIdAndDelete(userId);

    // 8. Attempt to destroy Cloudinary avatar (non-fatal)
    try {
      configureCloudinary();
      await cloudinary.uploader.destroy(
        `spliteasy/avatars/user_${userId}`
      );
    } catch (cloudinaryError) {
      // Non-fatal — log but do not fail the request
      logError(
        "[user account DELETE] Cloudinary destroy failed",
        cloudinaryError
      );
    }

    // 9. Build response and clear the authToken cookie
    const response = NextResponse.json({ success: true }, { status: 200 });

    response.cookies.set("authToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error: any) {
    logError("[user account DELETE]", error);
    return errorResponse("Internal server error", 500);
  }
}
