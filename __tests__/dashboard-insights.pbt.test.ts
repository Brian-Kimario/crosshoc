// Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps

/**
 * Property-Based Tests for Dashboard Insights daily trend logic.
 *
 * Feature: group-analytics-spending-insights
 *
 * Properties tested:
 *   P4 – Daily trend covers exactly 30 days with no gaps
 *
 * Validates: Requirements 4.4
 *
 * Approach: The insights route contains two pure helper functions:
 *   - `buildLast30Days(now)` — builds the ordered 30-day date string array
 *   - zero-fill logic — merges a date→totalCents map with the 30-day array
 *
 * We re-implement the same pure logic here and test it directly, avoiding
 * any need to mock the database or HTTP layer.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure helpers (mirrors the logic in app/api/dashboard/insights/route.ts)
// ---------------------------------------------------------------------------

/**
 * Format a Date as a YYYY-MM-DD string using UTC calendar fields.
 */
function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Build an array of the last 30 calendar day strings (today inclusive),
 * ordered from oldest (index 0) to newest (index 29).
 */
function buildLast30Days(now: Date): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - i
      )
    );
    days.push(toDateString(d));
  }
  return days;
}

/**
 * Zero-fill the daily trend: given a map of date → totalCents and the
 * ordered 30-day array, produce an array of { date, totalCents } entries
 * where missing dates get totalCents: 0.
 */
function buildDailyTrend(
  dailyMap: Map<string, number>,
  last30Days: string[]
): Array<{ date: string; totalCents: number }> {
  return last30Days.map((date) => ({
    date,
    totalCents: dailyMap.get(date) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * A "now" date constrained to a safe UTC range so that subtracting 29 days
 * never produces invalid dates or year-boundary edge cases that would confuse
 * the test assertions.
 *
 * We use integer milliseconds rather than fc.date() to guarantee valid dates
 * (fc.date() can generate NaN dates in some fast-check versions).
 */
const NOW_MIN_MS = new Date('2023-02-01T00:00:00.000Z').getTime();
const NOW_MAX_MS = new Date('2030-12-31T23:59:59.999Z').getTime();

const nowArb = fc
  .integer({ min: NOW_MIN_MS, max: NOW_MAX_MS })
  .map((ms) => new Date(ms));

/**
 * A random expense date that falls somewhere within the last 30 calendar days
 * relative to a given `now`.  We generate an offset in [0, 29] days back.
 */
function expenseDateWithinWindow(now: Date): fc.Arbitrary<string> {
  return fc.integer({ min: 0, max: 29 }).map((daysBack) => {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysBack
      )
    );
    return toDateString(d);
  });
}

/**
 * A random expense date that falls OUTSIDE the last 30 calendar days
 * (i.e., 30 or more days before `now`).
 */
function expenseDateOutsideWindow(now: Date): fc.Arbitrary<string> {
  return fc.integer({ min: 30, max: 365 }).map((daysBack) => {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysBack
      )
    );
    return toDateString(d);
  });
}

/**
 * A map of date → totalCents built from a list of (date, amount) pairs.
 * Multiple entries for the same date are summed (mirrors the $group stage).
 */
function buildDailyMap(
  entries: Array<{ date: string; totalCents: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const { date, totalCents } of entries) {
    map.set(date, (map.get(date) ?? 0) + totalCents);
  }
  return map;
}

// ---------------------------------------------------------------------------
// P4: Daily trend covers exactly 30 days with no gaps
// Validates: Requirements 4.4
// ---------------------------------------------------------------------------

describe('P4: Daily trend covers exactly 30 days with no gaps', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * For any call to the Insights_API, the `dailyTrend` array SHALL contain
   * exactly 30 entries, one for each of the last 30 calendar days, with no
   * missing dates and `totalCents: 0` for days with no expenses.
   */

  // ── Sub-property 4a: buildLast30Days always returns exactly 30 entries ──

  it('buildLast30Days returns exactly 30 entries for any "now" date', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(nowArb, (now) => {
        const days = buildLast30Days(now);
        expect(days).toHaveLength(30);
      }),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4b: buildLast30Days has no duplicate dates ──

  it('buildLast30Days contains no duplicate date strings', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(nowArb, (now) => {
        const days = buildLast30Days(now);
        const unique = new Set(days);
        expect(unique.size).toBe(30);
      }),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4c: buildLast30Days is ordered oldest → newest ──

  it('buildLast30Days is ordered from oldest (index 0) to newest (index 29)', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(nowArb, (now) => {
        const days = buildLast30Days(now);

        // Each consecutive pair must be in ascending order
        for (let i = 0; i < days.length - 1; i++) {
          expect(days[i] < days[i + 1]).toBe(true);
        }

        // The last entry must equal today's date string
        const todayStr = toDateString(now);
        expect(days[days.length - 1]).toBe(todayStr);
      }),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4d: buildLast30Days entries are valid YYYY-MM-DD strings ──

  it('buildLast30Days entries are valid YYYY-MM-DD strings', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    fc.assert(
      fc.property(nowArb, (now) => {
        const days = buildLast30Days(now);
        for (const day of days) {
          expect(isoDatePattern.test(day)).toBe(true);
          // Also verify it parses to a valid date
          const parsed = new Date(day + 'T00:00:00.000Z');
          expect(isNaN(parsed.getTime())).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4e: zero-fill produces exactly 30 entries ──

  it('buildDailyTrend produces exactly 30 entries regardless of how many expense dates are provided', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(
        nowArb,
        fc.array(fc.integer({ min: 1, max: 100_000 }), {
          minLength: 0,
          maxLength: 50,
        }),
        (now, amounts) => {
          const last30Days = buildLast30Days(now);

          // Build a map with random dates within the window
          const entries = amounts.map((amount, idx) => ({
            date: last30Days[idx % 30], // cycle through the 30 days
            totalCents: amount,
          }));
          const dailyMap = buildDailyMap(entries);

          const trend = buildDailyTrend(dailyMap, last30Days);
          expect(trend).toHaveLength(30);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4f: zero-fill has no duplicate dates in the result ──

  it('buildDailyTrend result contains no duplicate date entries', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(
        nowArb,
        fc.array(
          fc.record({
            daysBack: fc.integer({ min: 0, max: 29 }),
            totalCents: fc.integer({ min: 1, max: 100_000 }),
          }),
          { minLength: 0, maxLength: 60 }
        ),
        (now, rawEntries) => {
          const last30Days = buildLast30Days(now);

          const entries = rawEntries.map(({ daysBack, totalCents }) => {
            const d = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - daysBack
              )
            );
            return { date: toDateString(d), totalCents };
          });

          const dailyMap = buildDailyMap(entries);
          const trend = buildDailyTrend(dailyMap, last30Days);

          const dates = trend.map((e) => e.date);
          const uniqueDates = new Set(dates);
          expect(uniqueDates.size).toBe(30);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4g: days with no expenses have totalCents: 0 ──

  it('days with no expenses have totalCents: 0 in the result', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(
        nowArb,
        // Generate a sparse set of dates within the window that have expenses
        fc.array(fc.integer({ min: 0, max: 29 }), {
          minLength: 0,
          maxLength: 15,
        }),
        (now, daysBackWithExpenses) => {
          const last30Days = buildLast30Days(now);

          // Build a map with only the selected days having expenses
          const dailyMap = new Map<string, number>();
          for (const daysBack of daysBackWithExpenses) {
            const d = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - daysBack
              )
            );
            const dateStr = toDateString(d);
            dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + 1000);
          }

          const trend = buildDailyTrend(dailyMap, last30Days);

          // Every day NOT in the map must have totalCents: 0
          for (const entry of trend) {
            if (!dailyMap.has(entry.date)) {
              expect(entry.totalCents).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4h: days with expenses have the correct totalCents ──

  it('days with expenses have the correct totalCents in the result', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(
        nowArb,
        fc.array(
          fc.record({
            daysBack: fc.integer({ min: 0, max: 29 }),
            totalCents: fc.integer({ min: 1, max: 100_000 }),
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (now, rawEntries) => {
          const last30Days = buildLast30Days(now);

          const entries = rawEntries.map(({ daysBack, totalCents }) => {
            const d = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - daysBack
              )
            );
            return { date: toDateString(d), totalCents };
          });

          const dailyMap = buildDailyMap(entries);
          const trend = buildDailyTrend(dailyMap, last30Days);

          // Every day in the map must have the correct totalCents
          for (const entry of trend) {
            const expected = dailyMap.get(entry.date) ?? 0;
            expect(entry.totalCents).toBe(expected);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4i: expenses outside the 30-day window do not appear ──

  it('expense dates outside the 30-day window do not affect the trend result', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(
        nowArb,
        fc.array(
          fc.record({
            daysBack: fc.integer({ min: 30, max: 365 }),
            totalCents: fc.integer({ min: 1, max: 100_000 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (now, outsideEntries) => {
          const last30Days = buildLast30Days(now);

          // Build a map with only out-of-window dates
          const dailyMap = new Map<string, number>();
          for (const { daysBack, totalCents } of outsideEntries) {
            const d = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - daysBack
              )
            );
            const dateStr = toDateString(d);
            dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + totalCents);
          }

          const trend = buildDailyTrend(dailyMap, last30Days);

          // All 30 entries must have totalCents: 0 since no in-window dates exist
          for (const entry of trend) {
            expect(entry.totalCents).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4j: empty expense set produces all-zero trend ──

  it('empty expense set produces a 30-entry all-zero trend', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(nowArb, (now) => {
        const last30Days = buildLast30Days(now);
        const dailyMap = new Map<string, number>();
        const trend = buildDailyTrend(dailyMap, last30Days);

        expect(trend).toHaveLength(30);
        for (const entry of trend) {
          expect(entry.totalCents).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ── Sub-property 4k: result dates match the last30Days array exactly ──

  it('result date strings match the last30Days array in the same order', () => {
    // Feature: group-analytics-spending-insights, Property 4: Daily trend covers exactly 30 days with no gaps
    // Validates: Requirements 4.4
    fc.assert(
      fc.property(
        nowArb,
        fc.array(fc.integer({ min: 1, max: 50_000 }), {
          minLength: 0,
          maxLength: 30,
        }),
        (now, amounts) => {
          const last30Days = buildLast30Days(now);

          const entries = amounts.map((amount, idx) => ({
            date: last30Days[idx % 30],
            totalCents: amount,
          }));
          const dailyMap = buildDailyMap(entries);

          const trend = buildDailyTrend(dailyMap, last30Days);

          // The date at each index must match the corresponding entry in last30Days
          for (let i = 0; i < 30; i++) {
            expect(trend[i].date).toBe(last30Days[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
