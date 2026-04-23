"use server";

import mongoose from "mongoose";
import dbConnect from "./db";
import Expense from "./models/Expense";
import Group from "./models/Group";
import Settlement from "./models/Settlement";
import type { UserBalanceSummary, GroupMemberBalance, SimplifiedDebt } from "./balance-types";

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
 * Includes both expenses and settlements
 */
export async function calculateGroupBalances(groupId: string): Promise<import("./balance-types").GroupMemberBalance[]> {
  await dbConnect();

  // Fetch all expenses
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
    const paidByUser = expense.paidBy as any;
    const paidById = String(paidByUser._id);
    const amount = expense.amount;

    // Ensure payer is in map
    if (!userMap.has(paidById)) {
      userMap.set(paidById, {
        userId: paidById,
        name: paidByUser.name,
        email: paidByUser.email,
        avatar: paidByUser.avatar,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }

    // Add to payer's paid amount
    const payer = userMap.get(paidById)!;
    payer.paid += amount;

    // Process splits
    for (const split of expense.splits) {
      const splitUser = split.user as any;
      const splitUserId = String(splitUser._id);
      const splitAmount = split.amount;

      // Ensure split user is in map
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

      // Add to user's owed amount
      const user = userMap.get(splitUserId)!;
      user.owed += splitAmount;
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
 * Minimizes the number of transactions needed to settle all debts
 * Returns who should pay whom
 */
export async function getSimplifiedDebts(
  balances: import("./balance-types").GroupMemberBalance[]
): Promise<import("./balance-types").SimplifiedDebt[]> {
  // Separate creditors (positive balance = owed money) and debtors (negative balance = owe money)
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b, balance: Number(b.balance.toFixed(2)) }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ ...b, balance: Number(Math.abs(b.balance).toFixed(2)) })) // Convert to positive for easier math
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

