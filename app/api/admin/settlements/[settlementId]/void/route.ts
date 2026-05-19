import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { SettlementVoidedEmail } from "@/emails/SettlementVoidedEmail";
import React from "react";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error) return error;

  // 2. DB connection
  await dbConnect();

  const { settlementId } = await params;

  try {
    // 3. Parse and validate reason
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const reason = (body as any)?.reason;
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    // 4. Fetch the settlement
    const settlement = await Settlement.findById(settlementId)
      .populate("fromUser", "name email")
      .populate("toUser", "name email")
      .populate("group", "name");
    if (!settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
    }

    // 5. Check if already voided
    if (settlement.status === "voided") {
      return NextResponse.json({ error: "Settlement is already voided" }, { status: 409 });
    }

    // 6. Capture before state for audit log
    const before = {
      status:   settlement.status,
      amount:   settlement.amount,
      fromUser: (settlement.fromUser as any)._id
        ? (settlement.fromUser as any)._id.toString()
        : settlement.fromUser.toString(),
      toUser:   (settlement.toUser as any)._id
        ? (settlement.toUser as any)._id.toString()
        : settlement.toUser.toString(),
    };

    const groupId    = (settlement.group as any)._id
      ? (settlement.group as any)._id.toString()
      : settlement.group.toString();
    const resourceId = settlement._id.toString();
    const fromUserId = (settlement.fromUser as any)._id
      ? (settlement.fromUser as any)._id.toString()
      : settlement.fromUser.toString();
    const toUserId   = (settlement.toUser as any)._id
      ? (settlement.toUser as any)._id.toString()
      : settlement.toUser.toString();

    // Capture populated user/group data before voiding
    const fromUser   = settlement.fromUser as any;
    const toUser     = settlement.toUser as any;
    const group      = settlement.group as any;
    const formattedAmount = '$' + (settlement.amount / 100).toFixed(2);

    // 7. Void the settlement
    settlement.status          = "voided";
    settlement.adminNote       = reason.trim();
    settlement.resolvedByAdmin = session!.userId as any;
    settlement.resolvedAt      = new Date();
    await settlement.save();

    // 8. Fire-and-forget: invalidate balance cache
    invalidateBalanceCache(groupId).catch((err) =>
      logError("[admin void settlement] invalidateBalanceCache", err, { settlementId, groupId })
    );

    // 9. Fire-and-forget: audit log
    logAction({
      action:    "settlement.admin_voided",
      actorId:   session!.userId,
      actorName: session!.name,
      groupId,
      resourceId,
      before,
      after: { reason: reason.trim() },
    }).catch((err) =>
      logError("[admin void settlement] logAction", err, { settlementId, groupId })
    );

    // 10. Fire-and-forget: notify fromUser
    notify({
      userId:     fromUserId,
      type:       "settlement_disputed",
      title:      "Settlement voided by admin",
      body:       "A settlement you were part of has been voided by an admin.",
      groupId,
      resourceId,
    }).catch((err) =>
      logError("[admin void settlement] notify fromUser", err, { settlementId, userId: fromUserId })
    );

    // 11. Fire-and-forget: notify toUser
    notify({
      userId:     toUserId,
      type:       "settlement_disputed",
      title:      "Settlement voided by admin",
      body:       "A settlement you were part of has been voided by an admin.",
      groupId,
      resourceId,
    }).catch((err) =>
      logError("[admin void settlement] notify toUser", err, { settlementId, userId: toUserId })
    );

    // 12. Fire-and-forget: email fromUser
    sendEmail({
      to:       fromUser.email,
      subject:  "A settlement has been voided",
      react:    React.createElement(SettlementVoidedEmail, {
        name:          fromUser.name,
        amount:        formattedAmount,
        groupName:     group.name,
        fromUserName:  fromUser.name,
        toUserName:    toUser.name,
        reason:        reason.trim(),
        supportEmail:  process.env.SUPPORT_EMAIL ?? 'support@spliteasy.app',
      }),
      userId:   fromUserId,
      prefsKey: 'settlementVoided',
    }).catch((err) =>
      logError("[admin void settlement] sendEmail fromUser", err, { settlementId, userId: fromUserId })
    );

    // 13. Fire-and-forget: email toUser
    sendEmail({
      to:       toUser.email,
      subject:  "A settlement has been voided",
      react:    React.createElement(SettlementVoidedEmail, {
        name:          toUser.name,
        amount:        formattedAmount,
        groupName:     group.name,
        fromUserName:  fromUser.name,
        toUserName:    toUser.name,
        reason:        reason.trim(),
        supportEmail:  process.env.SUPPORT_EMAIL ?? 'support@spliteasy.app',
      }),
      userId:   toUserId,
      prefsKey: 'settlementVoided',
    }).catch((err) =>
      logError("[admin void settlement] sendEmail toUser", err, { settlementId, userId: toUserId })
    );

    // 14. Return success
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("[admin void settlement]", err, { settlementId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
