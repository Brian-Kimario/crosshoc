import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logError } from "@/lib/logger";
import type { EmailPrefsKey } from "@/lib/email";

const VALID_EMAIL_PREFS_KEYS: EmailPrefsKey[] = [
  "newLogin",
  "groupInvite",
  "inviteExpiringSoon",
  "expenseVoided",
  "settlementVoided",
  "removedFromGroup",
  "groupDeleted",
];

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const user = await User.findById(userId).select("emailPrefs").lean() as {
      emailPrefs?: Partial<Record<EmailPrefsKey, boolean>>;
    } | null;

    return successResponse({ emailPrefs: user?.emailPrefs ?? {} });
  } catch (err) {
    logError("[email-prefs GET]", err);
    return errorResponse("Failed to fetch email preferences", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return errorResponse("Request body must be an object", 400);
    }

    const updates = body as Record<string, unknown>;

    // Validate all keys are valid EmailPrefsKey values
    for (const key of Object.keys(updates)) {
      if (!VALID_EMAIL_PREFS_KEYS.includes(key as EmailPrefsKey)) {
        return errorResponse(`Invalid email preference key: ${key}`, 400);
      }
    }

    // Validate all values are booleans
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== "boolean") {
        return errorResponse(`Value for "${key}" must be a boolean`, 400);
      }
    }

    // Build $set with dot-notation keys so only provided fields are updated
    const setPayload: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(updates)) {
      setPayload[`emailPrefs.${key}`] = value as boolean;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: setPayload },
      { new: true }
    ).select("emailPrefs").lean() as {
      emailPrefs?: Partial<Record<EmailPrefsKey, boolean>>;
    } | null;

    return successResponse({ success: true, emailPrefs: updatedUser?.emailPrefs ?? {} });
  } catch (err) {
    logError("[email-prefs PATCH]", err);
    return errorResponse("Failed to update email preferences", 500);
  }
}
