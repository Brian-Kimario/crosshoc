import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { logError } from "@/lib/logger";

/**
 * GET /api/notifications
 * Returns recent notifications for the current user.
 * Query params: limit (default 20), unreadOnly (default false)
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = request.nextUrl;
    const limit      = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };
    if (unreadOnly) query.read = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        read: false,
      }),
    ]);

    return successResponse({ notifications, unreadCount });
  } catch (err) {
    logError('[notifications GET]', err);
    return errorResponse("Failed to fetch notifications", 500);
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { all: true }  — mark all unread as read
 *       { ids: string[] } — mark specific IDs as read
 */
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const body = await request.json();
    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (body.all === true) {
      await Notification.updateMany(
        { userId: userObjectId, read: false },
        { $set: { read: true } }
      );
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      const objectIds = body.ids
        .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
        .map((id: string) => new mongoose.Types.ObjectId(id));

      await Notification.updateMany(
        { _id: { $in: objectIds }, userId: userObjectId },
        { $set: { read: true } }
      );
    } else {
      return errorResponse("Provide { all: true } or { ids: string[] }", 400);
    }

    const unreadCount = await Notification.countDocuments({
      userId: userObjectId,
      read: false,
    });

    return successResponse({ unreadCount });
  } catch (err) {
    logError('[notifications PATCH]', err);
    return errorResponse("Failed to update notifications", 500);
  }
}
