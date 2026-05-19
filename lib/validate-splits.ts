/**
 * Server-side split validation.
 * Called at every expense creation and edit API boundary.
 * Never trust client-sent split data.
 */

import { formatMoney } from "./money";

export interface SplitInput {
  userId: string;
  amountCents: number;
}

export interface SplitValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSplits(
  totalCents: number,
  splits: SplitInput[],
  splitType: "equal" | "percentage" | "exact",
  currency: string
): SplitValidationResult {
  const errors: string[] = [];

  if (!splits || splits.length === 0) {
    errors.push("At least one split participant is required");
    return { valid: false, errors };
  }

  // All amounts must be non-negative integers
  for (const split of splits) {
    if (!Number.isInteger(split.amountCents)) {
      errors.push(`Split for ${split.userId} must be integer cents, got ${split.amountCents}`);
    }
    if (split.amountCents < 0) {
      errors.push(`Split for ${split.userId} cannot be negative`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Sum must exactly equal total
  const sum = splits.reduce((s, sp) => s + sp.amountCents, 0);
  if (sum !== totalCents) {
    errors.push(
      `Splits sum to ${formatMoney(sum, currency)} but expense total is ` +
        `${formatMoney(totalCents, currency)}. ` +
        `Difference: ${formatMoney(Math.abs(totalCents - sum), currency)}`
    );
  }

  // No duplicate user IDs
  const ids = splits.map((s) => s.userId);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push("Duplicate participant in splits");
  }

  return { valid: errors.length === 0, errors };
}
