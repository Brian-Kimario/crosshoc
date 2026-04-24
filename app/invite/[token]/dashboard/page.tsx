import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import GuestSession from "@/lib/models/GuestSession";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import { validateInviteToken } from "@/lib/invites";
import GuestDashboardClient from "./GuestDashboardClient";
import type { SupportedCurrency } from "@/lib/format-utils";

interface GuestDashboardPageProps {
  params: Promise<{ token: string }>;
}

interface Debt {
  creditorId: string;
  creditorName: string;
  amount: number;
  expenseIds: string[];
}

async function computeGuestDebts(
  groupId: string,
  guestId: string,
  guestName: string
): Promise<Debt[]> {
  // Find all expenses in this group where this guest appears
  const expenses = await Expense.find({
    group: groupId,
    $or: [
      { isGuest: true, guestId: guestId },
      { "splits.user": guestId },
    ],
  }).lean();

  // Also fetch guest settlements to deduct
  const GuestSettlement = (await import("@/lib/models/GuestSettlement")).default;
  const settlements = await GuestSettlement.find({
    group: groupId,
    guestId: guestId,
  }).lean();

  const totalSettled = settlements.reduce((sum, s) => sum + (s.amount || 0), 0);

  // Map to track debts per creditor
  const creditorDebts = new Map<string, { name: string; amount: number; expenseIds: string[] }>();

  for (const expense of expenses) {
    // Find this guest's share in the splits
    const guestSplit = (expense.splits as Array<{ user: string; amount: number }>).find(
      (s) => s.user === guestId
    );

    if (!guestSplit || guestSplit.amount <= 0) continue;

    // Who paid? Could be a registered user (paidBy) or another guest
    const payerId = String(expense.paidBy);
    const payerName = expense.guestName || "Someone"; // Default if we can't resolve

    // Only count if the payer is NOT this guest (i.e., guest owes the payer)
    if (payerId !== guestId) {
      const existing = creditorDebts.get(payerId);
      if (existing) {
        existing.amount += guestSplit.amount;
        existing.expenseIds.push(String(expense._id));
      } else {
        creditorDebts.set(payerId, {
          name: payerName,
          amount: guestSplit.amount,
          expenseIds: [String(expense._id)],
        });
      }
    }
  }

  // Apply settlements as deductions
  let remainingSettled = totalSettled;
  const debts: Debt[] = [];

  for (const [creditorId, data] of creditorDebts) {
    let amount = data.amount;
    if (remainingSettled > 0) {
      const deduction = Math.min(amount, remainingSettled);
      amount -= deduction;
      remainingSettled -= deduction;
    }
    if (amount > 0.01) {
      debts.push({
        creditorId,
        creditorName: data.name,
        amount,
        expenseIds: data.expenseIds,
      });
    }
  }

  return debts.sort((a, b) => b.amount - a.amount);
}

export default async function GuestDashboardPage({ params }: GuestDashboardPageProps) {
  await dbConnect();
  const { token } = await params;

  // Verify guest cookie exists
  const cookieStore = await cookies();
  const guestId = cookieStore.get("guestId")?.value;
  if (!guestId) redirect(`/invite/${token}`);

  // Verify guest session is valid
  const guestSession = await GuestSession.findOne({
    guestId,
    expiresAt: { $gt: new Date() },
  }).lean();

  if (!guestSession) redirect(`/invite/${token}`);

  // Verify invite token is still valid
  const tokenResult = await validateInviteToken(token);
  if (!tokenResult.valid) redirect("/invite/expired");

  // Get group details
  const group = await Group.findById(guestSession.groupId).lean();
  if (!group) redirect("/");

  // Calculate debts for this guest only
  const debts = await computeGuestDebts(
    String(group._id),
    guestId,
    guestSession.displayName
  );

  const totalOwed = debts.reduce((sum, d) => sum + d.amount, 0);

  return (
    <GuestDashboardClient
      token={token}
      guestId={guestId}
      guestName={guestSession.displayName}
      groupName={group.name}
      groupId={String(group._id)}
      currency={(group.currency || "USD") as SupportedCurrency}
      debts={debts}
      totalOwed={totalOwed}
    />
  );
}
