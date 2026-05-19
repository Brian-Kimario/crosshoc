import { NextRequest } from "next/server";

import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
  verifyAuth,
} from "@/lib/auth";
import dbConnect from "@/lib/db";
import { logError } from "@/lib/logger";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import {
  calculateGroupBalances,
  getSimplifiedDebts,
} from "@/lib/balance-server";

interface ConsolidatedDebtGroup {
  groupId: string;
  groupName: string;
  balanceCents: number;
}

interface ConsolidatedDebt {
  userId: string;
  userName: string;
  netCents: number;
  groups: ConsolidatedDebtGroup[];
}

/**
 * GET /api/user/consolidate-debts
 *
 * Aggregates balances across all active groups where the requesting user is a
 * member. Groups results by counterparty user ID and computes a net balance:
 *   - positive netCents → counterparty owes the requesting user
 *   - negative netCents → requesting user owes the counterparty
 *
 * Guest counterparties (userId starting with "guest::") are excluded.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // 1. Find all active groups where the requesting user is a member
    const activeGroups = await Group.find({
      "members.user": userId,
      status: { $ne: "archived" },
    })
      .select("_id name")
      .lean();

    const groupCount = activeGroups.length;

    if (groupCount === 0) {
      return successResponse({
        consolidatedDebts: [],
        totalOwedToMeCents: 0,
        totalIOweCents: 0,
        groupCount: 0,
      });
    }

    // Map: counterpartyId → { userName, groups: [...], netCents }
    const debtMap = new Map<
      string,
      { userName: string; netCents: number; groups: ConsolidatedDebtGroup[] }
    >();

    // 2. For each active group, compute simplified debts and aggregate
    for (const group of activeGroups) {
      const groupId = String(group._id);
      const groupName = group.name as string;

      let balances;
      try {
        balances = await calculateGroupBalances(groupId);
      } catch (err) {
        logError(`[consolidate-debts] Failed to calculate balances for group ${groupId}`, err);
        continue;
      }

      // Get simplified (minimized) debt transactions for this group
      const simplifiedDebts = await getSimplifiedDebts(balances);

      // Process each simplified debt transaction involving the requesting user
      for (const debt of simplifiedDebts) {
        const { from, fromName, to, toName, amount } = debt;

        if (from === userId) {
          // I owe `to` — negative from my perspective
          const counterpartyId = to;
          const counterpartyName = toName;

          // Skip guest counterparties
          if (counterpartyId.startsWith("guest::")) continue;

          const existing = debtMap.get(counterpartyId);
          if (existing) {
            existing.netCents -= amount;
            existing.groups.push({
              groupId,
              groupName,
              balanceCents: -amount,
            });
          } else {
            debtMap.set(counterpartyId, {
              userName: counterpartyName,
              netCents: -amount,
              groups: [{ groupId, groupName, balanceCents: -amount }],
            });
          }
        } else if (to === userId) {
          // `from` owes me — positive from my perspective
          const counterpartyId = from;
          const counterpartyName = fromName;

          // Skip guest counterparties
          if (counterpartyId.startsWith("guest::")) continue;

          const existing = debtMap.get(counterpartyId);
          if (existing) {
            existing.netCents += amount;
            existing.groups.push({
              groupId,
              groupName,
              balanceCents: amount,
            });
          } else {
            debtMap.set(counterpartyId, {
              userName: counterpartyName,
              netCents: amount,
              groups: [{ groupId, groupName, balanceCents: amount }],
            });
          }
        }
        // Transactions not involving the requesting user are ignored
      }
    }

    // 3. Resolve up-to-date user names from the User collection
    //    (simplified debts may have stale names from populated data)
    const counterpartyIds = Array.from(debtMap.keys());
    if (counterpartyIds.length > 0) {
      const users = await User.find({ _id: { $in: counterpartyIds } })
        .select("_id name displayName")
        .lean();

      for (const user of users as any[]) {
        const uid = String(user._id);
        const entry = debtMap.get(uid);
        if (entry) {
          // Prefer displayName if set, otherwise fall back to name
          entry.userName = (user.displayName as string) || (user.name as string);
        }
      }
    }

    // 4. Build the consolidated debts array (exclude zero-balance entries)
    const consolidatedDebts: ConsolidatedDebt[] = [];
    let totalOwedToMeCents = 0;
    let totalIOweCents = 0;

    for (const [uid, entry] of debtMap.entries()) {
      if (entry.netCents === 0) continue; // skip settled counterparties

      consolidatedDebts.push({
        userId: uid,
        userName: entry.userName,
        netCents: entry.netCents,
        groups: entry.groups,
      });

      if (entry.netCents > 0) {
        totalOwedToMeCents += entry.netCents;
      } else {
        totalIOweCents += Math.abs(entry.netCents);
      }
    }

    // Sort: largest absolute balance first
    consolidatedDebts.sort(
      (a, b) => Math.abs(b.netCents) - Math.abs(a.netCents)
    );

    return successResponse({
      consolidatedDebts,
      totalOwedToMeCents,
      totalIOweCents,
      groupCount,
    });
  } catch (error: unknown) {
    logError("[consolidate-debts GET]", error);
    return errorResponse("Failed to consolidate debts", 500);
  }
}
