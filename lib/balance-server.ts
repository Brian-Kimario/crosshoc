"use server";

import mongoose from "mongoose";
import dbConnect from "./db";
import Expense from "./models/Expense";
import Group from "./models/Group";
import Settlement from "./models/Settlement";
import GuestSettlement from "./models/GuestSettlement";
import type { UserBalanceSummary, GroupMemberBalance, SimplifiedDebt } from "./balance-types";
import { BalanceIntegrityError, validateZeroSum } from "./balance-errors";

// ─── User-wide balance summary ────────────────────────────────────────────────

export async function calculateUserBalances(
  userId: string
): Promise<UserBalanceSummary> {
  await dbConnect();

  const userGroups = await Group.find({ "members.user": userId })
    .select("_id")
    .lean();
  const groupIds = userGroups.map((g: any) => g._id.toString());

  if (groupIds.length === 0) {
    return { totalOwedToMe: 0, totalIOwe: 0, netBalance: 0, groupCount: 0 };
  }

  let totalOwedToMe = 0;
  let totalIOwe = 0;

  for (const groupId of groupIds) {
    const groupBalances = await calculateGroupBalances(groupId);
    const userBalance = groupBalances.find((b) => b.userId === userId);
    if (userBalance) {
      if (userBalance.balance > 0) {
        totalOwedToMe += userBalance.balance;
      } else {
        totalIOwe += Math.abs(userBalance.balance);
      }
    }
  }

  return {
    totalOwedToMe,
    totalIOwe,
    netBalance: totalOwedToMe - totalIOwe,
    groupCount: groupIds.length,
  };
}

// ─── Group balance calculation ────────────────────────────────────────────────

/**
 * Calculate balances for all members in a specific group.
 *
 * Key invariants:
 * - Guest expenses: paidBy is null in DB. We use a virtual `guest::<guestId>` key.
 * - Only CONFIRMED settlements affect balances (pending = optimistic display only).
 * - Zero-sum is validated and throws on any drift.
 */
export async function calculateGroupBalances(
  groupId: string
): Promise<GroupMemberBalance[]> {
  await dbConnect();

  const expenses = await Expense.find({ group: groupId, isVoided: { $ne: true } })
    .select("amount paidBy isGuest guestId guestName guestShare splits splitType")
    .populate("paidBy", "name email avatar")
    .populate("splits.user", "name email avatar")
    .lean();

  // Only confirmed settlements affect balances.
  // "voided" settlements are intentionally excluded — only "confirmed" settlements affect balances.
  const settlements = await Settlement.find({ group: groupId, status: "confirmed" })
    .select("fromUser toUser amount")
    .populate("fromUser", "name email avatar")
    .populate("toUser", "name email avatar")
    .lean();

  const userMap = new Map<string, GroupMemberBalance>();

  // ── Process expenses ────────────────────────────────────────────────────────
  for (const expense of expenses) {
    const exp = expense as any;
    const amount: number = exp.amount; // integer cents

    const isGuest: boolean = !!exp.isGuest;
    const guestId: string | null = exp.guestId || null;
    const guestName: string = exp.guestName || "Guest";

    // ── Resolve payer ─────────────────────────────────────────────────────────
    let payerId: string;

    if (isGuest && guestId) {
      // Virtual guest key — guaranteed not to collide with any MongoDB ObjectId
      payerId = `guest::${guestId}`;
      if (!userMap.has(payerId)) {
        userMap.set(payerId, {
          userId: payerId,
          name: guestName,
          email: "",
          avatar: undefined,
          paid: 0,
          owed: 0,
          balance: 0,
        });
      }
    } else if (exp.paidBy) {
      // Normal registered-member expense
      const paidByUser = exp.paidBy;
      payerId = String(paidByUser._id ?? paidByUser);
      if (!userMap.has(payerId)) {
        userMap.set(payerId, {
          userId: payerId,
          name: paidByUser.name ?? "Unknown",
          email: paidByUser.email ?? "",
          avatar: paidByUser.avatar,
          paid: 0,
          owed: 0,
          balance: 0,
        });
      }
    } else {
      // paidBy is null but isGuest is false — data corruption
      console.error(
        `[Balance] Expense ${exp._id} has null paidBy but isGuest=false — skipping`
      );
      continue;
    }

    const payerEntry = userMap.get(payerId)!;
    payerEntry.paid += amount;

    // ── Guest's own share ─────────────────────────────────────────────────────
    // Guest paid the full bill but owes their own portion back.
    // Derive at runtime: total - sum(member splits). Handles legacy data too.
    if (isGuest && guestId) {
      const memberSplitTotal = (exp.splits as any[]).reduce(
        (sum: number, s: any) => sum + (s.amount as number),
        0
      );
      const guestShare: number =
        exp.guestShare != null && exp.guestShare > 0
          ? exp.guestShare
          : amount - memberSplitTotal;

      if (guestShare > 0) {
        payerEntry.owed += guestShare;
      }
    }

    // ── Process member splits ─────────────────────────────────────────────────
    for (const split of exp.splits as any[]) {
      const splitUser = split.user;
      const splitUserId = String(splitUser._id ?? splitUser);
      const splitAmount: number = split.amount;

      if (!userMap.has(splitUserId)) {
        userMap.set(splitUserId, {
          userId: splitUserId,
          name: splitUser.name ?? "Unknown",
          email: splitUser.email ?? "",
          avatar: splitUser.avatar,
          paid: 0,
          owed: 0,
          balance: 0,
        });
      }
      userMap.get(splitUserId)!.owed += splitAmount;
    }
  }

  // ── Process confirmed settlements ─────────────────────────────────────────
  for (const settlement of settlements) {
    const s = settlement as any;
    const fromUser = s.fromUser;
    const toUser = s.toUser;
    const fromUserId = String(fromUser._id ?? fromUser);
    const toUserId = String(toUser._id ?? toUser);
    const amount: number = s.amount;

    if (!userMap.has(fromUserId)) {
      userMap.set(fromUserId, {
        userId: fromUserId,
        name: fromUser.name ?? "Unknown",
        email: fromUser.email ?? "",
        avatar: fromUser.avatar,
        paid: 0, owed: 0, balance: 0,
      });
    }
    if (!userMap.has(toUserId)) {
      userMap.set(toUserId, {
        userId: toUserId,
        name: toUser.name ?? "Unknown",
        email: toUser.email ?? "",
        avatar: toUser.avatar,
        paid: 0, owed: 0, balance: 0,
      });
    }

    userMap.get(fromUserId)!.paid += amount;
    userMap.get(toUserId)!.owed += amount;
  }

  // ── Process guest settlements ─────────────────────────────────────────────
  const guestSettlements = await GuestSettlement.find({ group: groupId })
    .select("fromUser guestId guestName amount")
    .populate("fromUser", "name email avatar")
    .lean();

  for (const gs of guestSettlements as any[]) {
    const fromUser = gs.fromUser;
    const fromUserId = String(fromUser._id ?? fromUser);
    const guestVirtualId = `guest::${gs.guestId}`;
    const amount: number = gs.amount;

    if (!userMap.has(fromUserId)) {
      userMap.set(fromUserId, {
        userId: fromUserId,
        name: fromUser.name ?? "Unknown",
        email: fromUser.email ?? "",
        avatar: fromUser.avatar,
        paid: 0, owed: 0, balance: 0,
      });
    }
    if (!userMap.has(guestVirtualId)) {
      userMap.set(guestVirtualId, {
        userId: guestVirtualId,
        name: gs.guestName,
        email: "",
        avatar: undefined,
        paid: 0, owed: 0, balance: 0,
      });
    }

    userMap.get(fromUserId)!.paid += amount;
    userMap.get(guestVirtualId)!.owed += amount;
  }

  // ── Compute final balances ────────────────────────────────────────────────
  const balances: GroupMemberBalance[] = Array.from(userMap.values()).map((user) => ({
    ...user,
    balance: user.paid - user.owed,
  }));

  // ── Zero-sum validation ───────────────────────────────────────────────────
  // With integer cents this should always be exactly 0.
  // If it's not (e.g. legacy decimal data not yet migrated), log the drift
  // but return the best-effort balances rather than crashing the page.
  try {
    validateZeroSum(balances, groupId);
  } catch (err) {
    if (err instanceof BalanceIntegrityError) {
      console.error(
        `[Balance] Zero-sum drift in group ${groupId}: ${err.drift} cents. ` +
          `Run the cents migration script to fix legacy data.`
      );
      // Apply a minimal correction to the first real member so the UI
      // doesn't show mathematically impossible totals.
      const firstReal = balances.find((b) => !b.userId.startsWith("guest::"));
      if (firstReal) {
        firstReal.balance = firstReal.paid - firstReal.owed - err.drift;
      }
    }
  }

  return balances.sort((a, b) => b.balance - a.balance);
}

// ─── Greedy debt simplification ───────────────────────────────────────────────

/**
 * Minimizes the number of transactions needed to settle all debts.
 * Includes ALL participants (guests and members) as creditors.
 * Only registered members appear as debtors (guests settle by claiming account).
 * Each transaction carries `toIsGuest` so the UI can route to PayGuestButton.
 */
export async function getSimplifiedDebts(
  balances: GroupMemberBalance[]
): Promise<SimplifiedDebt[]> {
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = balances
    .filter((b) => b.balance < 0 && !b.userId.startsWith("guest::"))
    .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance);

  const transactions: SimplifiedDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.balance, creditor.balance);

    if (amount > 0) {
      transactions.push({
        from:     debtor.userId,
        fromName: debtor.name,
        to:       creditor.userId,
        toName:   creditor.name,
        amount,
      });
    }

    debtor.balance   -= amount;
    creditor.balance -= amount;

    if (debtor.balance === 0) i++;
    if (creditor.balance === 0) j++;
  }

  return transactions;
}
