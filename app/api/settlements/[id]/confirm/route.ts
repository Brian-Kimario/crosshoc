import { NextRequest, NextResponse } from "next/server";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/money";
import { logError } from "@/lib/logger";

/**
 * PATCH /api/settlements/[id]/confirm
 * Only the CREDITOR (toUser) can confirm a pending settlement.
 * Confirming moves status → "confirmed" and invalidates the balance cache.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    const settlement = await Settlement.findById(id);
    if (!settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
    }

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

    await invalidateBalanceCache(String(settlement.group));

    const actor = await User.findById(userId).select("name").lean() as any;
    const creditorName = actor?.name ?? "Someone";

    await logAction({
      action: "settlement.confirmed",
      actorId: userId,
      actorName: creditorName,
      groupId: String(settlement.group),
      resourceId: id,
      after: { status: "confirmed", confirmedAt: settlement.confirmedAt },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Notify the debtor (fromUser) that their payment was confirmed
    const group = await (await import("@/lib/models/Group")).default
      .findById(settlement.group).select("name currency").lean() as any;
    const currency: string = group?.currency ?? "USD";

    await notify({
      userId:     String(settlement.fromUser),
      type:       "settlement_confirmed",
      title:      "Payment confirmed ✓",
      body:       `${creditorName} confirmed receipt of your ${formatMoney(settlement.amount, currency)} payment in ${group?.name ?? "your group"}`,
      groupId:    String(settlement.group),
      actorName:  creditorName,
      amount:     settlement.amount,
      currency,
      resourceId: id,
    });

    await settlement.populate([
      { path: "fromUser", select: "name email avatarUrl" },
      { path: "toUser",   select: "name email avatarUrl" },
    ]);

    return NextResponse.json({
      message: "Settlement confirmed",
      settlement: {
        _id:         settlement._id,
        amount:      settlement.amount,
        status:      settlement.status,
        confirmedAt: settlement.confirmedAt,
        fromUser:    settlement.fromUser,
        toUser:      settlement.toUser,
      },
    });
  } catch (err) {
    logError('[settlement confirm PATCH]', err);
    return NextResponse.json({ error: "Failed to confirm settlement" }, { status: 500 });
  }
}
