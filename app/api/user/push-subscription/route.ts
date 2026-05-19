import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logError } from "@/lib/logger";

/** POST /api/user/push-subscription — register a push subscription */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const subscription = await request.json();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return errorResponse("Invalid push subscription object", 400);
    }

    const userAgent = request.headers.get("user-agent") ?? undefined;

    // $addToSet won't add duplicates by endpoint
    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint: subscription.endpoint } }, // remove stale first
    });
    await User.findByIdAndUpdate(userId, {
      $push: {
        pushSubscriptions: {
          endpoint:  subscription.endpoint,
          keys:      subscription.keys,
          userAgent,
          createdAt: new Date(),
        },
      },
    });

    return successResponse({ registered: true });
  } catch (err) {
    logError('[push-subscription POST]', err);
    return errorResponse("Failed to register push subscription", 500);
  }
}

/** DELETE /api/user/push-subscription — unregister a push subscription */
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { endpoint } = await request.json();
    if (!endpoint) return errorResponse("endpoint is required", 400);

    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint } },
    });

    return successResponse({ unregistered: true });
  } catch (err) {
    logError('[push-subscription DELETE]', err);
    return errorResponse("Failed to unregister push subscription", 500);
  }
}
