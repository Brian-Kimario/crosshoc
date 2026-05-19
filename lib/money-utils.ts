/**
 * SplitEasy Money Utilities - Pure Client-Safe Utilities
 *
 * RULE: All internal calculations use integer cents.
 * Only convert to/from display format at the UI boundary.
 *
 * $3,000.00 → stored as 300000 (integer cents)
 * No floating point in any calculation path.
 *
 * This module has ZERO imports from app-specific models.
 * It is a pure utility — keep it that way.
 */

export interface CurrencyConfig {
  decimals: number;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  USD: { decimals: 2, symbol: "$",   name: "US Dollar",          locale: "en-US" },
  INR: { decimals: 2, symbol: "₹",   name: "Indian Rupee",       locale: "en-IN" },
  TZS: { decimals: 0, symbol: "TSh", name: "Tanzanian Shilling", locale: "sw-TZ" },
  KES: { decimals: 2, symbol: "KSh", name: "Kenyan Shilling",    locale: "en-KE" },
  GBP: { decimals: 2, symbol: "£",   name: "British Pound",      locale: "en-GB" },
  EUR: { decimals: 2, symbol: "€",   name: "Euro",               locale: "de-DE" },
};

/** Fallback config for unknown currencies */
const DEFAULT_CONFIG: CurrencyConfig = { decimals: 2, symbol: "$", name: "Unknown", locale: "en-US" };

function getConfig(currency: string): CurrencyConfig {
  return CURRENCY_CONFIG[currency] ?? DEFAULT_CONFIG;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert a display amount (e.g. 33.33) to integer cents (e.g. 3333).
 * Uses Math.round to eliminate floating-point drift.
 */
export function toCents(amount: number, currency = "USD"): number {
  const { decimals } = getConfig(currency);
  const factor = Math.pow(10, decimals);
  return Math.round((amount + Number.EPSILON) * factor);
}

/**
 * Convert integer cents (e.g. 3333) to display amount (e.g. 33.33).
 */
export function fromCents(cents: number, currency = "USD"): number {
  const { decimals } = getConfig(currency);
  const factor = Math.pow(10, decimals);
  return cents / factor;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format integer cents for display: 300000 → "$3,000.00"
 */
export function formatMoney(
  cents: number,
  currency = "USD",
  options?: { showSymbol?: boolean; showSign?: boolean }
): string {
  const { decimals, symbol, locale } = getConfig(currency);
  const amount = fromCents(Math.abs(cents), currency);
  const sign = options?.showSign ? (cents < 0 ? "-" : "+") : "";
  const sym = options?.showSymbol !== false ? symbol : "";
  return `${sign}${sym}${amount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Return just the currency symbol */
export function getCurrencySymbol(currency = "USD"): string {
  return getConfig(currency).symbol;
}

// ─── Distribution algorithms ──────────────────────────────────────────────────

/**
 * Distribute totalCents evenly among `count` participants.
 * The remainder (from integer division) is absorbed by the participant
 * at `payerIndex` (default 0) so the sum always equals totalCents exactly.
 *
 * Example: distributeEvenly(100, 3) → [34, 33, 33]  (sum = 100 ✓)
 */
export function distributeEvenly(
  totalCents: number,
  count: number,
  payerIndex = 0
): number[] {
  if (count <= 0) throw new Error("Count must be > 0");
  if (!Number.isInteger(totalCents)) throw new Error("totalCents must be an integer");

  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return Array.from({ length: count }, (_, i) =>
    i === payerIndex ? base + remainder : base
  );
}

/**
 * Distribute totalCents by percentages.
 * Percentages must sum to 100. Remainder absorbed by the largest-share participant.
 *
 * Example: distributeByPercentage(100, [50, 30, 20]) → [50, 30, 20]
 */
export function distributeByPercentage(
  totalCents: number,
  percentages: number[]
): number[] {
  if (!Number.isInteger(totalCents)) throw new Error("totalCents must be an integer");

  const sum = percentages.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 100) > 0.001) {
    throw new Error(`Percentages must sum to 100, got ${sum}`);
  }

  const raw = percentages.map((p) => Math.floor((totalCents * p) / 100));
  const distributed = raw.reduce((s, v) => s + v, 0);
  const remainder = totalCents - distributed;

  // Add remainder to largest-share participant
  const maxIdx = raw.indexOf(Math.max(...raw));
  raw[maxIdx] += remainder;

  return raw;
}

/**
 * Validate that exact splits sum to the total.
 * All values must be in cents (integers).
 */
export function validateExactSplits(
  totalCents: number,
  splitCents: number[]
): { valid: boolean; diff: number } {
  const sum = splitCents.reduce((s, v) => s + v, 0);
  return { valid: sum === totalCents, diff: totalCents - sum };
}

/** Exact integer comparison — safe because we use integers */
export function centsEqual(a: number, b: number): boolean {
  return a === b;
}

/**
 * Assert that a value is a valid cent amount (non-negative integer).
 * Throws if invalid — use at API boundaries.
 */
export function assertCents(value: unknown, fieldName = "amount"): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer (cents), got: ${value}`);
  }
  return value;
}
