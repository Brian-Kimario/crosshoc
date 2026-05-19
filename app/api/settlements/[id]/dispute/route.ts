import { NextRequest, NextResponse } from "next/server";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/money";
import { parseBody, DisputeSettlementSchema } from "@/lib/validations";
import { logError } from "@/lib/logger";

/**
 * PATCH /api/settlements/[id]/dispute
 * Only the CREDITOR (toUser) can dispute a pending settlement.
 * Disputed settlements do NOT affect balances (same as pending).
 * Body: { reason: string }
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
    const body = await request.json();
    const parsed = parseBody(DisputeSettlementSchema, body);
    if (!parsed.success) return parsed.response;
    const { reason } = parsed.data;

    const settlement = await Settlement.findById(id);
    if (!settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
    }

    if (String(settlement.toUser) !== String(userId)) {
      return NextResponse.json(
        { error: "Only the payment recipient can dispute this settlement" },
        { status: 403 }
      );
    }

    if (settlement.status !== "pending") {
      return NextResponse.json(
        { error: `Settlement is already ${settlement.status}` },
        { status: 400 }
      );
    }

    settlement.status        = "disputed";
    settlement.disputeReason = reason;
    await settlement.save();

    const actor = await User.findById(userId).select("name").lean() as any;
    const creditorName = actor?.name ?? "Someone";

    await logAction({
      action: "settlement.disputed",
      actorId: userId,
      actorName: creditorName,
      groupId: String(settlement.group),
      resourceId: id,
      after: { status: "disputed", disputeReason: reason },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Notify the debtor (fromUser) — urgent, their payment was rejected
    const group = await (await import("@/lib/models/Group")).default
      .findById(settlement.group).select("name currency").lean() as any;
    const currency: string = group?.currency ?? "USD";

    await notify({
      userId:     String(settlement.fromUser),
      type:       "settlement_disputed",
      title:      "Payment disputed ⚠",
      body:       `${creditorName} disputed your ${formatMoney(settlement.amount, currency)} payment in ${group?.name ?? "your group"}. Reason: "${reason}"`,
      groupId:    String(settlement.group),
      actorName:  creditorName,
      amount:     settlement.amount,
      currency,
      resourceId: id,
    });

    return NextResponse.json({
      message: "Settlement disputed",
      settlement: {
        _id:           settlement._id,
        status:        settlement.status,
        disputeReason: settlement.disputeReason,
      },
    });
  } catch (err) {
    logError('[settlement dispute]', err);
    return NextResponse.json({ error: "Failed to dispute settlement" }, { status: 500 });
  }
}
