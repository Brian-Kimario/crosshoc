import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { cookies } from "next/headers";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import GuestSettlement from "@/lib/models/GuestSettlement";
import GuestSession from "@/lib/models/GuestSession";
import { logError } from "@/lib/logger";

/**
 * POST /api/guest/settle
 * Records a settlement. Supports two modes:
 * 1. Member pays guest: { groupId, guestId, guestName, fromUserId, amount, note? }
 * 2. Guest pays member: { groupId, creditorId, amount, note? } (authenticated via guestId cookie)
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { groupId, guestId, guestName, fromUserId, creditorId, amount, note } = body;

    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Valid groupId is required", 400);
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return errorResponse("Amount must be greater than zero", 400);
    }

    const group = await Group.findById(groupId).select("members creator");
    if (!group) return errorResponse("Group not found", 404);

    // MODE 1: Member paying a guest (existing behavior, JWT auth required)
    if (guestId && fromUserId) {
      const userId = await verifyAuth(request);
      if (!userId) return unauthorizedResponse();

      if (!mongoose.Types.ObjectId.isValid(fromUserId)) {
        return errorResponse("Valid fromUserId is required", 400);
      }

      const isMember = group.members.some(
        (m: { user: mongoose.Types.ObjectId }) => String(m.user) === String(fromUserId)
      );
      if (!isMember) return errorResponse("fromUserId is not a member of this group", 403);

      const settlement = await GuestSettlement.create({
        group: groupId,
        fromUser: fromUserId,
        toUser: null,
        guestId,
        guestName: guestName || "Guest",
        amount: Math.round((parsedAmount + Number.EPSILON) * 100),  // Convert dollars to cents
        note: note || undefined,
        settledAt: new Date(),
      });

      return successResponse(
        {
          settlement: {
            _id: settlement._id,
            amount: settlement.amount,
            guestName: settlement.guestName,
            settledAt: settlement.settledAt,
          },
        },
        201
      );
    }

    // MODE 2: Guest paying a member (new behavior, guest cookie auth)
    if (creditorId) {
      const cookieStore = await cookies();
      const sessionGuestId = cookieStore.get("guestId")?.value;

      if (!sessionGuestId) {
        return NextResponse.json({ error: "No guest session" }, { status: 401 });
      }

      // Verify guest session is valid
      const guestSession = await GuestSession.findOne({
        guestId: sessionGuestId,
        groupId: new mongoose.Types.ObjectId(groupId),
        expiresAt: { $gt: new Date() },
      });

      if (!guestSession) {
        return NextResponse.json({ error: "Guest session expired" }, { status: 401 });
      }

      // Record the settlement (guest paying a member)
      const settlement = await GuestSettlement.create({
        group: groupId,
        fromUser: null,
        toUser: new mongoose.Types.ObjectId(creditorId),
        guestId: sessionGuestId,
        guestName: guestSession.displayName,
        amount: Math.round((parsedAmount + Number.EPSILON) * 100),  // Convert dollars to cents
        note: note || `Payment from ${guestSession.displayName}`,
        settledAt: new Date(),
        direction: "guest_to_member",
      });

      return successResponse(
        {
          settlement: {
            _id: settlement._id,
            amount: settlement.amount,
            settledAt: settlement.settledAt,
          },
        },
        201
      );
    }

    return errorResponse("Invalid request: must provide either (guestId + fromUserId) or creditorId", 400);
  } catch (err) {
    logError('[guest settle POST]', err);
    return errorResponse("Failed to record settlement", 500);
  }
}

/**
 * GET /api/guest/settle?groupId=...
 * Returns all guest settlements for a group.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const groupId = request.nextUrl.searchParams.get("groupId");
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Valid groupId is required", 400);
    }

    const group = await Group.findById(groupId).select("members");
    if (!group) return errorResponse("Group not found", 404);

    const isMember = group.members.some(
      (m: { user: mongoose.Types.ObjectId }) => String(m.user) === String(userId)
    );
    if (!isMember) return errorResponse("Not a member of this group", 403);

    const settlements = await GuestSettlement.find({ group: groupId })
      .populate("fromUser", "name email avatar")
      .sort({ settledAt: -1 })
      .lean();

    return successResponse({ settlements });
  } catch {
    return errorResponse("Failed to fetch guest settlements", 500);
  }
}
