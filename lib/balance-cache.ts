/**
 * Balance cache layer.
 * Caches calculated group balances in the Group document itself.
 * Eliminates full expense re-scan on every page load.
 *
 * Cache TTL: 30 seconds.
 * Invalidated explicitly after any expense or settlement mutation.
 */

import Group from "./models/Group";
import { calculateGroupBalances } from "./balance-server";
import type { GroupMemberBalance } from "./balance-types";

const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Get group balances — returns cached result if fresh, recalculates otherwise.
 */
export async function getGroupBalances(groupId: string): Promise<GroupMemberBalance[]> {
  const group = await Group.findById(groupId)
    .select("cachedBalances")
    .lean() as any;

  const cache = group?.cachedBalances;
  const now = Date.now();
  const cacheAge = cache?.calculatedAt
    ? now - new Date(cache.calculatedAt).getTime()
    : Infinity;

  // Return cache if fresh and populated
  if (cache?.data?.length && cacheAge < CACHE_TTL_MS) {
    return cache.data.map((entry: any) => ({
      userId:  entry.userId,
      name:    entry.userName,
      email:   "",
      avatar:  undefined,
      paid:    entry.paidCents,
      owed:    entry.owedCents,
      balance: entry.balanceCents,
    }));
  }

  // Recalculate and store
  const fresh = await calculateGroupBalances(groupId);

  await Group.findByIdAndUpdate(groupId, {
    "cachedBalances.data": fresh.map((b) => ({
      userId:       b.userId,
      userName:     b.name,
      isGuest:      b.userId.startsWith("guest::"),
      paidCents:    b.paid,
      owedCents:    b.owed,
      balanceCents: b.balance,
    })),
    "cachedBalances.calculatedAt": new Date(),
    $inc: { "cachedBalances.version": 1 },
  });

  return fresh;
}

/**
 * Invalidate the balance cache for a group.
 * Call this after ANY expense or settlement mutation.
 */
export async function invalidateBalanceCache(groupId: string): Promise<void> {
  await Group.findByIdAndUpdate(groupId, {
    $unset: { "cachedBalances.calculatedAt": 1 },
  });
}
