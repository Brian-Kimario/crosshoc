/**
 * Financial integrity error types.
 * Kept in a separate file so they can be imported by both
 * "use server" modules and regular server-side code.
 */

import type { GroupMemberBalance } from "./balance-types";

export class BalanceIntegrityError extends Error {
  constructor(
    message: string,
    public readonly groupId: string,
    public readonly drift: number
  ) {
    super(message);
    this.name = "BalanceIntegrityError";
  }
}

/**
 * Validate that the sum of all balances equals exactly 0.
 * THROWS BalanceIntegrityError instead of silently adjusting.
 */
export function validateZeroSum(
  balances: GroupMemberBalance[],
  groupId: string
): void {
  const total = balances.reduce((s, u) => s + u.balance, 0);
  if (total !== 0) {
    console.error("[Balance Critical]", {
      groupId,
      drift: total,
      balances: balances.map((b) => ({
        userId:  b.userId,
        paid:    b.paid,
        owed:    b.owed,
        balance: b.balance,
      })),
    });
    throw new BalanceIntegrityError(
      `Zero-sum violated in group ${groupId}. ` +
        `Drift: ${total} cents. This indicates corrupted expense or split data.`,
      groupId,
      total
    );
  }
}
