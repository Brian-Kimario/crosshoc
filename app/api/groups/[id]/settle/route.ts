import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { verifyAuth, errorResponse, successResponse, unauthorizedResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Settlement from "@/lib/models/Settlement";
import User from "@/lib/models/User";
import { formatMoney } from "@/lib/money";
import { logAction } from "@/lib/audit";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { notify } from "@/lib/notify";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { parseBody, CreateSettlementSchema } from "@/lib/validations";
import { logError } from "@/lib/logger";

/**
 * POST /api/groups/[id]/settle
 * Records a settlement payment between two group members.
 * Supports idempotency via optional `idempotencyKey`.
 * New settlements start as "pending" — balance only updates on confirmation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const rateLimitResult = await checkRateLimit(request, 'mutation');
    if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult);

    const { id: groupId } = await params;
    const body = await request.json();

    const parsed = parseBody(CreateSettlementSchema, body);
    if (!parsed.success) return parsed.response;

    const { fromUserId, toUserId, amount, method = "cash", note, idempotencyKey } = parsed.data;

    // Idempotency check — return existing record if key already used
    if (idempotencyKey) {
      const existing = await Settlement.findOne({ idempotencyKey })
        .populate("fromUser", "name email avatar avatarUrl")
        .populate("toUser", "name email avatar avatarUrl")
        .lean();
      if (existing) {
        return NextResponse.json({ settlement: existing, idempotent: true }, { status: 200 });
      }
    }

    const group = await Group.findById(groupId).select("members currency");
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const isMember = group.members.some(
      (m: any) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
    }

    const memberIds = group.members.map((m: any) => String(m.user));
    if (!memberIds.includes(String(fromUserId)) || !memberIds.includes(String(toUserId))) {
      return NextResponse.json({ error: "Both users must be members of the group" }, { status: 400 });
    }

    const currency: string = group.currency || "USD";

    // amount is sent as INTEGER CENTS from the client (settle-up-button.tsx)
    // Validated by CreateSettlementSchema (integer, positive)
    const amountCents = amount;

    const settlement = await Settlement.create({
      group: new mongoose.Types.ObjectId(groupId),
      fromUser: new mongoose.Types.ObjectId(fromUserId),
      toUser: new mongoose.Types.ObjectId(toUserId),
      amount: amountCents,
      method,
      note: note || undefined,
      status: "pending",
      idempotencyKey: idempotencyKey || undefined,
      settledAt: new Date(),
    });

    // NOTE: pending settlements do NOT invalidate balance cache.
    // Cache is only invalidated on confirmation.

    await settlement.populate([
      { path: "fromUser", select: "name email avatar avatarUrl" },
      { path: "toUser", select: "name email avatar avatarUrl" },
    ]);

    const actor = await User.findById(userId).select("name").lean() as any;
    const actorName = actor?.name ?? userId;

    await logAction({
      action: "settlement.created",
      actorId: userId,
      actorName,
      groupId,
      resourceId: String(settlement._id),
      after: { fromUserId, toUserId, amount: amountCents, status: "pending" },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Notify the CREDITOR (toUser) — they need to confirm
    await notify({
      userId:     String(toUserId),
      type:       "settlement_made",
      title:      "Payment received — confirm?",
      body:       `${actorName} says they paid you ${formatMoney(amountCents, currency)} in ${group.name}`,
      groupId,
      actorName,
      amount:     amountCents,
      currency,
      resourceId: String(settlement._id),
      metadata:   { settlementId: String(settlement._id) },
    });

    return NextResponse.json(
      {
        message: "Settlement recorded — awaiting confirmation",
        settlement: {
          _id: settlement._id,
          amount: settlement.amount,
          method: settlement.method,
          status: settlement.status,
          fromUser: settlement.fromUser,
          toUser: settlement.toUser,
          settledAt: settlement.settledAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logError('[settle POST]', error);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}

/**
 * GET /api/groups/[id]/settle
 * Returns all settlements for a group (all statuses for display).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id: groupId } = await params;

    const group = await Group.findById(groupId).select("members");
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const isMember = group.members.some(
      (m: any) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
    }

    const settlements = await Settlement.find({ group: groupId })
      .select("fromUser toUser amount method note status settledAt confirmedAt")
      .populate("fromUser", "name email avatar avatarUrl")
      .populate("toUser", "name email avatar avatarUrl")
      .sort({ settledAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ settlements });
  } catch (error) {
    logError('[settle GET]', error);
    return NextResponse.json({ error: "Failed to fetch settlements" }, { status: 500 });
  }
}
