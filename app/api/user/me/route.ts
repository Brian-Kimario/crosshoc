import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import {
  verifyAuth,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/auth";
import { logError } from "@/lib/logger";

// Fields to select for the profile response
const PROFILE_SELECT =
  "name email displayName bio avatarUrl preferences createdAt isAdmin";

// Zod schema for PATCH /api/user/me
const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).trim().optional(),
  bio: z.string().max(200).trim().optional(),
  preferences: z
    .object({
      currency: z
        .enum(["USD", "TZS", "KES", "INR", "GBP", "EUR"])
        .optional(),
      splitMethod: z.enum(["equal", "percent", "exact"]).optional(),
      timezone: z.string().max(50).optional(),
    })
    .optional(),
});

// GET /api/user/me — return the authenticated user's profile
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const user = await User.findById(userId).select(PROFILE_SELECT);
    if (!user) {
      return unauthorizedResponse();
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        preferences: user.preferences,
        createdAt: user.createdAt,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error: any) {
    logError("[user me GET]", error);
    return errorResponse("Internal server error", 500);
  }
}

// PATCH /api/user/me — update displayName, bio, and/or preferences
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return errorResponse(message, 400);
    }

    const data = parsed.data;

    // Build dot-notation updateFields to avoid overwriting the entire
    // preferences sub-document when only one preference key is provided
    const updateFields: Record<string, unknown> = {};

    if (data.displayName !== undefined) {
      updateFields["displayName"] = data.displayName;
    }
    if (data.bio !== undefined) {
      updateFields["bio"] = data.bio;
    }
    if (data.preferences) {
      const prefs = data.preferences;
      if (prefs.currency !== undefined) {
        updateFields["preferences.currency"] = prefs.currency;
      }
      if (prefs.splitMethod !== undefined) {
        updateFields["preferences.splitMethod"] = prefs.splitMethod;
      }
      if (prefs.timezone !== undefined) {
        updateFields["preferences.timezone"] = prefs.timezone;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return errorResponse("No valid fields provided", 400);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select(PROFILE_SELECT);

    if (!updatedUser) {
      return unauthorizedResponse();
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        bio: updatedUser.bio,
        avatarUrl: updatedUser.avatarUrl,
        preferences: updatedUser.preferences,
        createdAt: updatedUser.createdAt,
        isAdmin: updatedUser.isAdmin,
      },
    });
  } catch (error: any) {
    logError("[user me PATCH]", error);
    return errorResponse("Internal server error", 500);
  }
}
