import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logError } from "@/lib/logger";

const VALID_KEYS = [
  "expense_added",
  "expense_edited",
  "expense_deleted",
  "settlement_made",
  "settlement_confirmed",
  "settlement_disputed",
  "member_joined",
  "guest_joined",
  "invite_expiring",
  "debt_reminder",
] as const;

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const user = await User.findById(userId).select("notificationPrefs").lean() as any;

    // Build a complete prefs object — absent keys default to true
    const prefs: Record<string, boolean> = {};
    for (const key of VALID_KEYS) {
      prefs[key] = user?.notificationPrefs?.[key] !== false;
    }

    return successResponse({ prefs });
  } catch (err) {
    logError('[notification-prefs GET]', err);
    return errorResponse("Failed to fetch preferences", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { key, value } = await request.json();

    if (!VALID_KEYS.includes(key)) {
      return errorResponse(`Invalid preference key: ${key}`, 400);
    }

    await User.findByIdAndUpdate(userId, {
      $set: { [`notificationPrefs.${key}`]: Boolean(value) },
    });

    return successResponse({ success: true });
  } catch (err) {
    logError('[notification-prefs PATCH]', err);
    return errorResponse("Failed to update preference", 500);
  }
}
