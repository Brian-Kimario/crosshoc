import { NextRequest, NextResponse } from "next/server";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { logError } from "@/lib/logger";

/**
 * POST /api/groups/[id]/settle/[sid]/confirm
 * Only the CREDITOR (toUser) can confirm a settlement.
 * Confirming moves status from "pending" → "confirmed" and
 * triggers a balance cache invalidation so the UI reflects the payment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id: groupId, sid: settlementId } = await params;

    const settlement = await Settlement.findById(settlementId);
    if (!settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
    }

    // Only the creditor (toUser) can confirm
    if (String(settlement.toUser) !== String(userId)) {
      return NextResponse.json(
        { error: "Only the payment recipient can confirm this settlement" },
        { status: 403 }
      );
    }

    if (settlement.status !== "pending") {
      return NextResponse.json(
        { error: `Settlement is already ${settlement.status}` },
        { status: 400 }
      );
    }

    settlement.status      = "confirmed";
    settlement.confirmedAt = new Date();
    await settlement.save();

    // Confirmed settlements affect balances — invalidate cache
    await invalidateBalanceCache(groupId);

    const actor = await User.findById(userId).select("name").lean() as any;
    await logAction({
      action: "settlement.confirmed",
      actorId: userId,
      actorName: actor?.name ?? userId,
      groupId,
      resourceId: settlementId,
      after: { status: "confirmed", confirmedAt: settlement.confirmedAt },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    await settlement.populate([
      { path: "fromUser", select: "name email avatar avatarUrl" },
      { path: "toUser", select: "name email avatar avatarUrl" },
    ]);

    return NextResponse.json({
      message: "Settlement confirmed",
      settlement: {
        _id: settlement._id,
        amount: settlement.amount,
        status: settlement.status,
        confirmedAt: settlement.confirmedAt,
        fromUser: settlement.fromUser,
        toUser: settlement.toUser,
      },
    });
  } catch (error) {
    logError('[settle/confirm POST]', error);
    return NextResponse.json({ error: "Failed to confirm settlement" }, { status: 500 });
  }
}
