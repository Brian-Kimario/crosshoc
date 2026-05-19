import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/format-utils";
import { invalidateBalanceCache } from "@/lib/balance-cache";

/**
 * POST /api/admin/disputes/[id]/resolve
 * Admin resolves a disputed settlement.
 * resolution: "confirm" → confirmed | "reject" → pending | "void" → disputed (locked)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { resolution, note } = await req.json();

  if (!["confirm", "reject", "void"].includes(resolution)) {
    return NextResponse.json({ error: "Invalid resolution" }, { status: 400 });
  }

  await dbConnect();

  const settlement = await Settlement.findById(id)
    .populate("fromUser", "name _id")
    .populate("toUser",   "name _id")
    .populate("group",    "name currency _id");

  if (!settlement) {
    return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
  }

  if (settlement.status !== "disputed") {
    return NextResponse.json(
      { error: `Settlement is ${settlement.status}, not disputed` },
      { status: 400 }
    );
  }

  // Map resolution to new status
  // "void" keeps status as "disputed" but marks it admin-resolved (no balance effect)
  const newStatus =
    resolution === "confirm" ? "confirmed" :
    resolution === "reject"  ? "pending"   :
    "disputed"; // void — stays disputed, admin note explains why

  settlement.status          = newStatus as any;
  settlement.adminNote       = note || undefined;
  settlement.resolvedByAdmin = session.userId as any;
  settlement.resolvedAt      = new Date();
  await settlement.save();

  // Only confirmed resolutions affect balances
  if (newStatus === "confirmed") {
    await invalidateBalanceCache(String((settlement.group as any)._id));
  }

  const group    = settlement.group as any;
  const currency = group.currency ?? "USD";
  const amount   = formatCurrency(settlement.amount, currency);

  const resolutionLabel =
    resolution === "confirm" ? "confirmed" :
    resolution === "reject"  ? "returned to pending" :
    "voided by admin";

  const message =
    `Admin resolved your disputed payment of ${amount} in ${group.name}. ` +
    `Decision: ${resolutionLabel}.` +
    (note ? ` Note: "${note}"` : "");

  // Notify both parties
  await Promise.all([
    notify({
      userId:  String((settlement.fromUser as any)._id),
      type:    "settlement_confirmed",
      title:   "Dispute resolved by admin",
      body:    message,
      groupId: String(group._id),
    }),
    notify({
      userId:  String((settlement.toUser as any)._id),
      type:    "settlement_confirmed",
      title:   "Dispute resolved by admin",
      body:    message,
      groupId: String(group._id),
    }),
  ]);

  await logAction({
    action:    "settlement.admin_resolved",
    actorId:   session.userId,
    actorName: session.name,
    groupId:   String(group._id),
    resourceId: id,
    after:     { resolution, note, newStatus },
  });

  return NextResponse.json({ success: true, newStatus });
}
