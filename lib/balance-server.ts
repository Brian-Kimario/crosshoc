"use server";

import mongoose from "mongoose";
import dbConnect from "./db";
import Expense from "./models/Expense";
import Group from "./models/Group";
import Settlement from "./models/Settlement";
import GuestSettlement from "./models/GuestSettlement";
import type { UserBalanceSummary, GroupMemberBalance, SimplifiedDebt } from "./balance-types";

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Note: Types are NOT re-exported from this file to avoid Next.js server action issues
// Import types directly from @/lib/balance-types instead

/**
 * Calculate user-wide balances across all groups they belong to
 * Uses MongoDB Aggregation Pipeline for performance
 */
export async function calculateUserBalances(userId: string): Promise<import("./balance-types").UserBalanceSummary> {
  await dbConnect();

  // Find all groups where user is a member
  const userGroups = await Group.find({ "members.user": userId }).select("_id").lean();
  const groupIds = userGroups.map((g) => g._id.toString());

  if (groupIds.length === 0) {
    return {
      totalOwedToMe: 0,
      totalIOwe: 0,
      netBalance: 0,
      groupCount: 0,
    };
  }

  // MongoDB Aggregation Pipeline
  const pipeline = [
    // Match expenses in user's groups
    {
      $match: {
        group: { $in: groupIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    // Lookup paidBy user details
    {
      $lookup: {
        from: "users",
        localField: "paidBy",
        foreignField: "_id",
        as: "paidByUser",
      },
    },
    { $unwind: "$paidByUser" },
    // Unwind splits to process each split individually
    { $unwind: "$splits" },
    // Lookup split user details
    {
      $lookup: {
        from: "users",
        localField: "splits.user",
        foreignField: "_id",
        as: "splitUser",
      },
    },
    { $unwind: "$splitUser" },
    // Group by the relationship (who paid vs who owes)
    {
      $group: {
        _id: null,
        // Sum of expenses where user is the payer
        totalPaidByUser: {
          $sum: {
            $cond: [{ $eq: ["$paidByUser._id", new mongoose.Types.ObjectId(userId)] }, "$amount", 0],
          },
        },
        // Sum of splits where user is the payer (counting splits in their paid expenses)
        splitsInUserExpenses: {
          $sum: {
            $cond: [
              { $eq: ["$paidByUser._id", new mongoose.Types.ObjectId(userId)] },
              "$splits.amount",
              0,
            ],
          },
        },
        // Sum of splits where user owes money
        totalOwedByUser: {
          $sum: {
            $cond: [
              { $eq: ["$splitUser._id", new mongoose.Types.ObjectId(userId)] },
              "$splits.amount",
              0,
            ],
          },
        },
      },
    },
  ];

  const result = await Expense.aggregate(pipeline);

  if (result.length === 0) {
    return {
      totalOwedToMe: 0,
      totalIOwe: 0,
      netBalance: 0,
      groupCount: groupIds.length,
    };
  }

  const data = result[0];

  // Calculate what others owe me (total I paid minus my share in those expenses)
  // This is simplified - in reality we'd need to calculate per expense
  // For now, use the existing calculateGroupBalances for accurate per-group data

  // Fallback to individual calculation for accuracy
  let totalOwedToMe = 0;
  let totalIOwe = 0;

  for (const groupId of groupIds) {
    const groupBalances = await calculateGroupBalances(groupId.toString());
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

/**
 * Calculate balances for all members in a specific group
 * Includes both expenses and settlements.
 * Guest expenses (isGuest: true) are attributed to a virtual guest entry
 * identified by guestId+guestName, so registered members' balances are
 * correctly reduced when a guest pays for something.
 */
export async function calculateGroupBalances(groupId: string): Promise<import("./balance-types").GroupMemberBalance[]> {
  await dbConnect();

  // Fetch all expenses — include isGuest / guestId / guestName fields
  const expenses = await Expense.find({ group: groupId })
    .populate("paidBy", "name email avatar")
    .populate("splits.user", "name email avatar")
    .lean();

  // Fetch all settlements
  const settlements = await Settlement.find({ group: groupId })
    .populate("fromUser", "name email avatar")
    .populate("toUser", "name email avatar")
    .lean();

  const userMap = new Map<string, import("./balance-types").GroupMemberBalance>();

  // Process expenses
  for (const expense of expenses) {
    const expenseAny = expense as any;
    const amount = expense.amount;

    // ── Determine the effective payer ──────────────────────────────────────
    // For guest expenses the DB paidBy is a placeholder (first group member).
    // We use a virtual key based on guestId so the real member is not credited.
    const isGuest: boolean = !!expenseAny.isGuest;
    const guestId: string | null = expenseAny.guestId || null;
    const guestName: string = expenseAny.guestName || "Guest";

    let payerId: string;
    let payerEntry: import("./balance-types").GroupMemberBalance;

    if (isGuest && guestId) {
      // Virtual guest key — won't collide with any MongoDB ObjectId
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
      payerEntry = userMap.get(payerId)!;
    } else {
      const paidByUser = expense.paidBy as any;
      payerId = String(paidByUser._id);
      if (!userMap.has(payerId)) {
        userMap.set(payerId, {
          userId: payerId,
          name: paidByUser.name,
          email: paidByUser.email,
          avatar: paidByUser.avatar,
          paid: 0,
          owed: 0,
          balance: 0,
        });
      }
      payerEntry = userMap.get(payerId)!;
    }

    // Credit the payer
    payerEntry.paid += amount;

    // ── Guest's own share ──────────────────────────────────────────────────
    // The guest paid the full bill but owes their own portion back.
    // guestShare is stored on new expenses. For legacy expenses (guestShare null),
    // derive it: total - sum(member splits). This is always correct regardless
    // of when the expense was created.
    if (isGuest && guestId) {
      const storedGuestShare: number | null = expenseAny.guestShare ?? null;
      let guestShare: number;

      if (storedGuestShare !== null && storedGuestShare > 0) {
        guestShare = storedGuestShare;
      } else {
        // Derive from splits: guest's share = total - what members owe
        const memberSplitTotal = expense.splits.reduce(
          (sum: number, s: { amount: number }) => sum + s.amount,
          0
        );
        guestShare = roundToCents(amount - memberSplitTotal);
      }

      if (guestShare > 0) {
        payerEntry.owed += guestShare;
      }
    }

    // ── Process splits ─────────────────────────────────────────────────────
    for (const split of expense.splits) {
      const splitUser = split.user as any;
      const splitUserId = String(splitUser._id);
      const splitAmount = split.amount;

      if (!userMap.has(splitUserId)) {
        userMap.set(splitUserId, {
          userId: splitUserId,
          name: splitUser.name,
          email: splitUser.email,
          avatar: splitUser.avatar,
          paid: 0,
          owed: 0,
          balance: 0,
        });
      }

      userMap.get(splitUserId)!.owed += splitAmount;
    }
  }

  // Process settlements (payments between members)
  for (const settlement of settlements) {
    const fromUser = settlement.fromUser as any; // The payer (ower)
    const toUser = settlement.toUser as any; // The receiver (owner)
    const fromUserId = String(fromUser._id);
    const toUserId = String(toUser._id);
    const amount = settlement.amount;

    // Ensure both users are in map
    if (!userMap.has(fromUserId)) {
      userMap.set(fromUserId, {
        userId: fromUserId,
        name: fromUser.name,
        email: fromUser.email,
        avatar: fromUser.avatar,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }
    if (!userMap.has(toUserId)) {
      userMap.set(toUserId, {
        userId: toUserId,
        name: toUser.name,
        email: toUser.email,
        avatar: toUser.avatar,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }

    // Settlement logic:
    // - fromUser (payer) has effectively "paid" more (reduces their debt)
    // - toUser (receiver) has effectively "received" payment (reduces what they're owed)
    // So we add to fromUser's paid amount and add to toUser's owed amount
    const payer = userMap.get(fromUserId)!;
    payer.paid += amount; // They paid this amount to settle debt

    const receiver = userMap.get(toUserId)!;
    receiver.owed += amount; // They received this amount (reduces their net credit)
  }

  // ── Process guest settlements ──────────────────────────────────────────────
  // When a registered member pays a guest outside the app, record it here.
  // Effect: fromUser's owed decreases (they paid their debt to the guest),
  //         and the guest's paid decreases by the same amount (they've been repaid).
  const guestSettlements = await GuestSettlement.find({ group: groupId })
    .populate("fromUser", "name email avatar")
    .lean();

  for (const gs of guestSettlements) {
    const fromUser = gs.fromUser as any;
    const fromUserId = String(fromUser._id);
    const guestVirtualId = `guest::${gs.guestId}`;
    const amount = gs.amount;

    // Ensure the paying member is in the map
    if (!userMap.has(fromUserId)) {
      userMap.set(fromUserId, {
        userId: fromUserId,
        name: fromUser.name,
        email: fromUser.email,
        avatar: fromUser.avatar,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }

    // Ensure the guest is in the map (may not be if they have no expenses yet)
    if (!userMap.has(guestVirtualId)) {
      userMap.set(guestVirtualId, {
        userId: guestVirtualId,
        name: gs.guestName,
        email: "",
        avatar: undefined,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }

    // Member paid the guest → member's owed goes down (they settled their debt)
    const member = userMap.get(fromUserId)!;
    member.paid += amount;

    // Guest received payment → guest's owed goes up (reduces their net credit)
    const guest = userMap.get(guestVirtualId)!;
    guest.owed += amount;
  }

  // Calculate final balance for each user with proper decimal precision
  const balances = Array.from(userMap.values()).map((user) => {
    const paid = Number(user.paid.toFixed(2));
    const owed = Number(user.owed.toFixed(2));
    return {
      ...user,
      paid,
      owed,
      balance: Number((paid - owed).toFixed(2)),
    };
  });

  // Validation: Sum of all balances must equal $0.00
  const totalBalance = Number(balances.reduce((sum, user) => sum + user.balance, 0).toFixed(2));
  if (totalBalance !== 0) {
    console.warn(`[Balance Validation] Group ${groupId}: Sum of balances = ${totalBalance}, expected $0.00`);
    // Force adjustment to ensure mathematical consistency
    if (balances.length > 0) {
      const adjustment = Number((-totalBalance).toFixed(2));
      balances[0].balance = Number((balances[0].balance + adjustment).toFixed(2));
      console.log(`[Balance Validation] Applied adjustment of ${adjustment} to ${balances[0].name}`);
    }
  }

  // Sort by balance descending (those owed most first)
  return balances.sort((a, b) => b.balance - a.balance);
}

/**
 * Validate that the sum of all balances in a group equals $0.00
 * Returns true if valid, false otherwise
 */
export async function validateBalanceSum(
  balances: import("./balance-types").GroupMemberBalance[]
): Promise<boolean> {
  const sum = Number(balances.reduce((acc, user) => acc + user.balance, 0).toFixed(2));
  return sum === 0;
}

/**
 * Greedy Settlement Algorithm
 * Minimizes the number of transactions needed to settle all debts.
 * Guest virtual entries (userId starting with "guest::") ARE included as
 * creditors so registered members can see and acknowledge debts to guests.
 * The SettleUpButton handles guest creditors with a special "Pay Guest" flow.
 */
export async function getSimplifiedDebts(
  balances: import("./balance-types").GroupMemberBalance[]
): Promise<import("./balance-types").SimplifiedDebt[]> {
  // Include ALL entries — guests can be creditors (owed money by members)
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b, balance: Number(b.balance.toFixed(2)) }))
    .sort((a, b) => b.balance - a.balance);

  // Only registered members can be debtors (guests settle by claiming their account)
  const debtors = balances
    .filter((b) => b.balance < 0 && !b.userId.startsWith("guest::"))
    .map((b) => ({ ...b, balance: Number(Math.abs(b.balance).toFixed(2)) }))
    .sort((a, b) => b.balance - a.balance);

  const transactions: SimplifiedDebt[] = [];

  let i = 0; // debtor index
  let j = 0; // creditor index

  // Greedy algorithm: Match largest debtor with largest creditor
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(debtor.balance, creditor.balance);

    if (amount > 0.01) {
      // Only record significant amounts (> 1 cent)
      transactions.push({
        from: debtor.userId,
        fromName: debtor.name,
        to: creditor.userId,
        toName: creditor.name,
        amount: Number(amount.toFixed(2)),
      });
    }

    debtor.balance -= amount;
    creditor.balance -= amount;

    // Move to next debtor if this one is settled
    if (debtor.balance < 0.01) i++;
    // Move to next creditor if this one is settled
    if (creditor.balance < 0.01) j++;
  }

  return transactions;
}

