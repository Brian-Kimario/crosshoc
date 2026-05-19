// Feature: group-analytics-spending-insights, Property 1: Period filtering includes only in-window expenses
// Feature: group-analytics-spending-insights, Property 2: Voided expenses are excluded from all totals
// Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100

/**
 * Property-Based Tests for Group Analytics pure transformation logic.
 *
 * Feature: group-analytics-spending-insights
 *
 * Properties tested:
 *   P1 – Period filtering includes only in-window expenses
 *   P2 – Voided expenses are excluded from all totals
 *   P3 – Category percentages sum to 100
 *
 * Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.10, 3.12
 *
 * Approach: The analytics route uses a MongoDB aggregation pipeline. Rather
 * than testing the full HTTP handler, we test the pure transformation helpers
 * extracted into `lib/analytics-helpers.ts`. These functions implement the
 * same logic as the pipeline stages and are fully deterministic.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterByPeriod,
  filterVoided,
  computeTotalCents,
  computeCategoryBreakdown,
  aggregateByCategory,
  periodStartDate,
  type RawExpense,
  type Period,
} from '@/lib/analytics-helpers';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Valid period values */
const periodArb = fc.constantFrom<Period>('7d', '30d', '90d', 'all');

/** A bounded period (excludes "all" so date filtering is exercised) */
const boundedPeriodArb = fc.constantFrom<Period>('7d', '30d', '90d');

/** A single raw expense with random amount, category, createdAt, and isVoided */
const expenseArb = fc.record({
  amount: fc.integer({ min: 1, max: 1_000_000 }),
  category: fc.constantFrom(
    'food', 'transport', 'accommodation', 'entertainment',
    'groceries', 'utilities', 'health', 'shopping', 'other'
  ),
  createdAt: fc.date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
  }),
  isVoided: fc.boolean(),
});

/** An array of 0–50 raw expenses */
const expenseArrayArb = fc.array(expenseArb, { minLength: 0, maxLength: 50 });

/** An array of 1–50 raw expenses (non-empty) */
const nonEmptyExpenseArrayArb = fc.array(expenseArb, { minLength: 1, maxLength: 50 });

// ---------------------------------------------------------------------------
// P1: Period filtering includes only in-window expenses
// Validates: Requirements 3.2, 3.3, 3.4, 3.5
// ---------------------------------------------------------------------------

describe('P1: Period filtering includes only in-window expenses', () => {
  /**
   * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
   *
   * For any set of expenses with random createdAt timestamps and a bounded
   * period value (7d, 30d, 90d), filterByPeriod SHALL include exactly those
   * expenses whose createdAt >= (now - period_days * 86400000), and SHALL
   * exclude all others.
   */

  it('includes only expenses whose createdAt is within the period window', () => {
    // Feature: group-analytics-spending-insights, Property 1: Period filtering includes only in-window expenses
    // Validates: Requirements 3.2, 3.3, 3.4, 3.5
    fc.assert(
      fc.property(
        expenseArrayArb,
        boundedPeriodArb,
        // Use a fixed "now" so the window is deterministic within each run
        fc.date({
          min: new Date('2025-01-01T00:00:00.000Z'),
          max: new Date('2030-01-01T00:00:00.000Z'),
        }),
        (expenses, period, now) => {
          const result = filterByPeriod(expenses, period, now);
          const startDate = periodStartDate(period, now)!;

          // Every returned expense must be within the window
          for (const e of result) {
            expect(e.createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
          }

          // Every expense within the window must appear in the result
          const inWindow = expenses.filter((e) => e.createdAt >= startDate);
          expect(result.length).toBe(inWindow.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('excludes all expenses whose createdAt is before the period window', () => {
    // Feature: group-analytics-spending-insights, Property 1: Period filtering includes only in-window expenses
    // Validates: Requirements 3.2, 3.3, 3.4, 3.5
    fc.assert(
      fc.property(
        expenseArrayArb,
        boundedPeriodArb,
        fc.date({
          min: new Date('2025-01-01T00:00:00.000Z'),
          max: new Date('2030-01-01T00:00:00.000Z'),
        }),
        (expenses, period, now) => {
          const result = filterByPeriod(expenses, period, now);
          const startDate = periodStartDate(period, now)!;

          // No returned expense should be before the window
          const beforeWindow = result.filter((e) => e.createdAt < startDate);
          expect(beforeWindow.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns all expenses when period is "all" (no date filter)', () => {
    // Feature: group-analytics-spending-insights, Property 1: Period filtering includes only in-window expenses
    // Validates: Requirements 3.5
    fc.assert(
      fc.property(
        expenseArrayArb,
        fc.date(),
        (expenses, now) => {
          const result = filterByPeriod(expenses, 'all', now);
          // "all" means no date filter — every expense is included
          expect(result.length).toBe(expenses.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: expense exactly at the period start is included', () => {
    // Feature: group-analytics-spending-insights, Property 1: Period filtering includes only in-window expenses
    // Validates: Requirements 3.2, 3.3, 3.4
    fc.assert(
      fc.property(
        boundedPeriodArb,
        // Use a bounded date range to avoid NaN dates from fc.date() with no constraints
        fc.integer({ min: 1_700_000_000_000, max: 1_900_000_000_000 }).map((ms) => new Date(ms)),
        (period, now) => {
          const startDate = periodStartDate(period, now)!;
          // Create an expense exactly at the boundary
          const boundaryExpense: RawExpense = {
            amount: 100,
            category: 'food',
            createdAt: startDate,
            isVoided: false,
          };
          const result = filterByPeriod([boundaryExpense], period, now);
          // Boundary is inclusive (>= startDate)
          expect(result.length).toBe(1);
          expect(result[0]).toBe(boundaryExpense);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: expense 1ms before the period start is excluded', () => {
    // Feature: group-analytics-spending-insights, Property 1: Period filtering includes only in-window expenses
    // Validates: Requirements 3.2, 3.3, 3.4
    fc.assert(
      fc.property(
        boundedPeriodArb,
        fc.date({
          min: new Date('2025-06-01T00:00:00.000Z'),
          max: new Date('2030-01-01T00:00:00.000Z'),
        }),
        (period, now) => {
          const startDate = periodStartDate(period, now)!;
          // Create an expense 1ms before the boundary
          const justBeforeExpense: RawExpense = {
            amount: 100,
            category: 'food',
            createdAt: new Date(startDate.getTime() - 1),
            isVoided: false,
          };
          const result = filterByPeriod([justBeforeExpense], period, now);
          // 1ms before boundary is excluded
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// P2: Voided expenses are excluded from all totals
// Validates: Requirements 3.10
// ---------------------------------------------------------------------------

describe('P2: Voided expenses are excluded from all totals', () => {
  /**
   * **Validates: Requirements 3.10**
   *
   * For any set of expenses where some have isVoided: true, the computed
   * totalSpentCents SHALL equal the sum of amount values for non-voided
   * expenses only.
   */

  it('totalSpentCents equals sum of non-voided expense amounts only', () => {
    // Feature: group-analytics-spending-insights, Property 2: Voided expenses are excluded from all totals
    // Validates: Requirements 3.10
    fc.assert(
      fc.property(
        expenseArrayArb,
        (expenses) => {
          const nonVoided = filterVoided(expenses);
          const total = computeTotalCents(nonVoided);

          // Manually compute expected total from non-voided expenses
          const expectedTotal = expenses
            .filter((e) => !e.isVoided)
            .reduce((sum, e) => sum + e.amount, 0);

          expect(total).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('voided expenses contribute zero to the total', () => {
    // Feature: group-analytics-spending-insights, Property 2: Voided expenses are excluded from all totals
    // Validates: Requirements 3.10
    fc.assert(
      fc.property(
        // Generate at least one voided expense
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 1_000_000 }),
            category: fc.constantFrom('food', 'transport', 'other'),
            createdAt: fc.date(),
            isVoided: fc.constant(true),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 1_000_000 }),
            category: fc.constantFrom('food', 'transport', 'other'),
            createdAt: fc.date(),
            isVoided: fc.constant(false),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (voidedExpenses, nonVoidedExpenses) => {
          const allExpenses = [...voidedExpenses, ...nonVoidedExpenses];
          const filtered = filterVoided(allExpenses);
          const total = computeTotalCents(filtered);

          // Total must equal sum of non-voided amounts only
          const expectedTotal = nonVoidedExpenses.reduce((sum, e) => sum + e.amount, 0);
          expect(total).toBe(expectedTotal);

          // No voided expense should appear in filtered result
          for (const e of filtered) {
            expect(e.isVoided).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total is zero when all expenses are voided', () => {
    // Feature: group-analytics-spending-insights, Property 2: Voided expenses are excluded from all totals
    // Validates: Requirements 3.10
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 1_000_000 }),
            category: fc.constantFrom('food', 'other'),
            createdAt: fc.date(),
            isVoided: fc.constant(true),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (voidedExpenses) => {
          const filtered = filterVoided(voidedExpenses);
          const total = computeTotalCents(filtered);
          expect(total).toBe(0);
          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total equals full sum when no expenses are voided', () => {
    // Feature: group-analytics-spending-insights, Property 2: Voided expenses are excluded from all totals
    // Validates: Requirements 3.10
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 1_000_000 }),
            category: fc.constantFrom('food', 'other'),
            createdAt: fc.date(),
            isVoided: fc.constant(false),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (nonVoidedExpenses) => {
          const filtered = filterVoided(nonVoidedExpenses);
          const total = computeTotalCents(filtered);
          const expectedTotal = nonVoidedExpenses.reduce((sum, e) => sum + e.amount, 0);
          expect(total).toBe(expectedTotal);
          expect(filtered.length).toBe(nonVoidedExpenses.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('voided exclusion is independent of period filtering', () => {
    // Feature: group-analytics-spending-insights, Property 2: Voided expenses are excluded from all totals
    // Validates: Requirements 3.10
    fc.assert(
      fc.property(
        expenseArrayArb,
        periodArb,
        fc.date({
          min: new Date('2025-01-01T00:00:00.000Z'),
          max: new Date('2030-01-01T00:00:00.000Z'),
        }),
        (expenses, period, now) => {
          // Apply both filters (as the route does: match stage filters both)
          const periodFiltered = filterByPeriod(expenses, period, now);
          const fullyFiltered = filterVoided(periodFiltered);
          const total = computeTotalCents(fullyFiltered);

          // Manually compute expected total
          const startDate = periodStartDate(period, now);
          const expectedTotal = expenses
            .filter((e) => !e.isVoided)
            .filter((e) => startDate === null || e.createdAt >= startDate)
            .reduce((sum, e) => sum + e.amount, 0);

          expect(total).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// P3: Category percentages sum to 100
// Validates: Requirements 3.12
// ---------------------------------------------------------------------------

describe('P3: Category percentages sum to 100', () => {
  /**
   * **Validates: Requirements 3.12**
   *
   * For any non-empty set of expenses grouped by category, the sum of all
   * percentage values in categoryBreakdown SHALL equal 100 within a tolerance
   * of 0.01 to account for rounding.
   */

  it('category percentages sum to 100 (within 0.01 tolerance) for any non-empty expense set', () => {
    // Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100
    // Validates: Requirements 3.12
    fc.assert(
      fc.property(
        nonEmptyExpenseArrayArb,
        (expenses) => {
          // Filter voided (as the route does) then aggregate
          const active = filterVoided(expenses);
          if (active.length === 0) return; // skip if all voided

          const categoryTotals = aggregateByCategory(active);
          const breakdown = computeCategoryBreakdown(categoryTotals);

          if (breakdown.length === 0) return; // no categories

          const sum = breakdown.reduce((acc, item) => acc + item.percentage, 0);
          expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each percentage is non-negative', () => {
    // Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100
    // Validates: Requirements 3.12
    fc.assert(
      fc.property(
        nonEmptyExpenseArrayArb,
        (expenses) => {
          const active = filterVoided(expenses);
          if (active.length === 0) return;

          const categoryTotals = aggregateByCategory(active);
          const breakdown = computeCategoryBreakdown(categoryTotals);

          for (const item of breakdown) {
            expect(item.percentage).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each percentage is at most 100', () => {
    // Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100
    // Validates: Requirements 3.12
    fc.assert(
      fc.property(
        nonEmptyExpenseArrayArb,
        (expenses) => {
          const active = filterVoided(expenses);
          if (active.length === 0) return;

          const categoryTotals = aggregateByCategory(active);
          const breakdown = computeCategoryBreakdown(categoryTotals);

          for (const item of breakdown) {
            expect(item.percentage).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('single-category breakdown has percentage of exactly 100', () => {
    // Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100
    // Validates: Requirements 3.12
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 1_000_000 }),
            category: fc.constant('food'),
            createdAt: fc.date(),
            isVoided: fc.constant(false),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (expenses) => {
          const categoryTotals = aggregateByCategory(expenses);
          const breakdown = computeCategoryBreakdown(categoryTotals);

          expect(breakdown.length).toBe(1);
          expect(breakdown[0].percentage).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('percentage sum is 100 for any number of distinct categories', () => {
    // Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100
    // Validates: Requirements 3.12
    fc.assert(
      fc.property(
        // Generate category totals directly (positive amounts, distinct categories)
        fc.array(
          fc.record({
            category: fc.constantFrom(
              'food', 'transport', 'accommodation', 'entertainment',
              'groceries', 'utilities', 'health', 'shopping', 'other'
            ),
            totalCents: fc.integer({ min: 1, max: 1_000_000 }),
          }),
          { minLength: 1, maxLength: 9 }
        ).map((items) => {
          // Deduplicate by category (keep last occurrence)
          const map = new Map<string, number>();
          for (const item of items) {
            map.set(item.category, item.totalCents);
          }
          return Array.from(map.entries()).map(([category, totalCents]) => ({
            category,
            totalCents,
          }));
        }),
        (categoryTotals) => {
          if (categoryTotals.length === 0) return;

          const breakdown = computeCategoryBreakdown(categoryTotals);
          const sum = breakdown.reduce((acc, item) => acc + item.percentage, 0);
          expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array for empty input', () => {
    // Feature: group-analytics-spending-insights, Property 3: Category percentages sum to 100
    // Validates: Requirements 3.12
    const result = computeCategoryBreakdown([]);
    expect(result).toEqual([]);
  });
});
