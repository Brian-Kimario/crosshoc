/**
 * Pure transformation helpers extracted from the Group Analytics API.
 * These functions are stateless and have no side effects, making them
 * suitable for property-based testing.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = "7d" | "30d" | "90d" | "all";

export interface RawExpense {
  amount: number;
  category: string;
  createdAt: Date;
  isVoided: boolean;
}

export interface CategoryTotal {
  category: string;
  totalCents: number;
}

export interface CategoryBreakdownItem {
  category: string;
  totalCents: number;
  percentage: number;
}

// ─── Period helpers ───────────────────────────────────────────────────────────

/**
 * Convert a period string to the number of days it represents.
 * Returns null for "all" (no date filter).
 */
export function periodToDays(period: Period): number | null {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return null;
  }
}

/**
 * Compute the start-of-window Date for a given period relative to `now`.
 * Returns null when period is "all".
 */
export function periodStartDate(period: Period, now: Date = new Date()): Date | null {
  const days = periodToDays(period);
  if (days === null) return null;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Filter an array of raw expenses to only those within the given period window.
 * Voided expenses are NOT filtered here — use `filterVoided` for that.
 */
export function filterByPeriod(expenses: RawExpense[], period: Period, now: Date = new Date()): RawExpense[] {
  const startDate = periodStartDate(period, now);
  if (startDate === null) {
    // "all" — no date filter
    return expenses;
  }
  return expenses.filter((e) => e.createdAt >= startDate);
}

// ─── Voided expense filter ────────────────────────────────────────────────────

/**
 * Filter out voided expenses from an array.
 */
export function filterVoided(expenses: RawExpense[]): RawExpense[] {
  return expenses.filter((e) => !e.isVoided);
}

/**
 * Compute the total spent in cents for a set of expenses.
 * Assumes voided expenses have already been filtered out.
 */
export function computeTotalCents(expenses: RawExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

// ─── Category percentage calculation ─────────────────────────────────────────

/**
 * Compute category breakdown with percentages from a list of category totals.
 *
 * Uses the "largest remainder method" to ensure:
 *   1. All percentages are non-negative
 *   2. Percentages sum to exactly 100 (within floating-point precision)
 *   3. Each percentage is rounded to 2 decimal places
 *
 * Returns an empty array when input is empty.
 */
export function computeCategoryBreakdown(
  rawCategories: CategoryTotal[]
): CategoryBreakdownItem[] {
  if (rawCategories.length === 0) return [];

  const grandTotal = rawCategories.reduce((sum, c) => sum + c.totalCents, 0);

  if (grandTotal === 0) {
    // All amounts are zero — assign equal percentages
    const equalPct = Math.round((100 / rawCategories.length) * 100) / 100;
    let allocated = 0;
    return rawCategories.map((c, i) => {
      if (i === rawCategories.length - 1) {
        return {
          category: c.category,
          totalCents: c.totalCents,
          percentage: Math.max(0, Math.round((100 - allocated) * 100) / 100),
        };
      }
      allocated += equalPct;
      return { category: c.category, totalCents: c.totalCents, percentage: equalPct };
    });
  }

  // Compute raw (unrounded) percentages
  const withRaw = rawCategories.map((c) => ({
    category: c.category,
    totalCents: c.totalCents,
    rawPct: (c.totalCents / grandTotal) * 100,
  }));

  // Floor each to 2 decimal places, track remainders for largest-remainder adjustment
  const SCALE = 100; // 2 decimal places
  const TARGET = 10000; // 100.00 * 100

  const floored = withRaw.map((c) => ({
    ...c,
    floor: Math.floor(c.rawPct * SCALE) / SCALE,
    remainder: (c.rawPct * SCALE) % 1,
  }));

  const floorSum = floored.reduce((sum, c) => sum + Math.round(c.floor * SCALE), 0);
  let remaining = TARGET - floorSum; // number of 0.01 units to distribute

  // Sort by remainder descending to give extra 0.01 to items with largest remainders
  const sorted = [...floored]
    .map((c, idx) => ({ ...c, idx }))
    .sort((a, b) => b.remainder - a.remainder);

  const adjustments = new Array(floored.length).fill(0);
  for (let i = 0; i < remaining && i < sorted.length; i++) {
    adjustments[sorted[i].idx] = 1; // add 0.01
  }

  return floored.map((c, i) => ({
    category: c.category,
    totalCents: c.totalCents,
    percentage: Math.max(0, (Math.round(c.floor * SCALE) + adjustments[i]) / SCALE),
  }));
}

/**
 * Aggregate raw expenses into category totals, sorted by totalCents descending.
 */
export function aggregateByCategory(expenses: RawExpense[]): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const cat = e.category ?? "other";
    map.set(cat, (map.get(cat) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
