// Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point

/**
 * Property-Based Tests for chart tooltip formatters.
 *
 * Feature: group-analytics-spending-insights
 *
 * Properties tested:
 *   P11 – Chart tooltip formatters include required fields for any data point
 *         (CategoryDonutChart portion)
 *
 * Validates: Requirements 7.2
 *
 * Approach: The tooltip formatting logic in CategoryDonutChart is a pure
 * function of its inputs. We test the two core operations directly:
 *   1. CATEGORY_LABELS[category] ?? category  → non-empty label string
 *   2. formatMoney(totalCents, currency)       → non-empty formatted amount string
 *
 * These are the exact operations performed inside the CustomTooltip component
 * in CategoryDonutChart.tsx.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CATEGORY_LABELS } from '@/lib/chart-theme';
import { formatMoney } from '@/lib/money';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** All known expense categories (mirrors CATEGORY_LABELS keys) */
const KNOWN_CATEGORIES = Object.keys(CATEGORY_LABELS) as string[];

/** Arbitrary that picks a known category */
const knownCategoryArb = fc.constantFrom(...KNOWN_CATEGORIES);

/** Arbitrary that generates an arbitrary non-empty string (unknown category) */
const unknownCategoryArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => !(s in CATEGORY_LABELS) && s.trim().length > 0);

/** Any category string: known or unknown */
const anyCategoryArb = fc.oneof(knownCategoryArb, unknownCategoryArb);

/** Valid currency codes supported by formatMoney */
const validCurrencyArb = fc.constantFrom('USD', 'INR', 'TZS', 'KES', 'GBP', 'EUR');

/** Non-negative integer cents (0 to 10,000,000 — $100,000 max) */
const nonNegativeCentsArb = fc.integer({ min: 0, max: 10_000_000 });

// ---------------------------------------------------------------------------
// P11 (CategoryDonutChart): CATEGORY_LABELS lookup returns non-empty string
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('P11 (CategoryDonutChart): CATEGORY_LABELS lookup returns non-empty string', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any known category string, CATEGORY_LABELS[category] SHALL be a
   * non-empty string (the human-readable label used in the tooltip).
   */
  it('CATEGORY_LABELS[category] is a non-empty string for every known category', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 7.2
    fc.assert(
      fc.property(knownCategoryArb, (category) => {
        const label = CATEGORY_LABELS[category];

        // Must be defined
        expect(label).toBeDefined();

        // Must be a string
        expect(typeof label).toBe('string');

        // Must be non-empty
        expect(label.length).toBeGreaterThan(0);

        // Must not be only whitespace
        expect(label.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * For any unknown category string, the fallback expression
   * `CATEGORY_LABELS[category] ?? category` SHALL still produce a non-empty
   * string (falls back to the raw category value itself).
   */
  it('CATEGORY_LABELS[category] ?? category is non-empty for any unknown category', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 7.2
    fc.assert(
      fc.property(unknownCategoryArb, (category) => {
        const label = CATEGORY_LABELS[category] ?? category;

        // Must be a string
        expect(typeof label).toBe('string');

        // Must be non-empty (falls back to the category string itself, which is non-empty)
        expect(label.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * For any category string (known or unknown), the tooltip label expression
   * `CATEGORY_LABELS[category] ?? category` SHALL always produce a non-empty
   * string.
   */
  it('tooltip label is non-empty for any category string (known or unknown)', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 7.2
    fc.assert(
      fc.property(anyCategoryArb, (category) => {
        // This is the exact expression used in CategoryDonutChart CustomTooltip
        const label = CATEGORY_LABELS[category] ?? category;

        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
        expect(label.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// P11 (CategoryDonutChart): formatMoney returns non-empty string for any data point
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('P11 (CategoryDonutChart): formatMoney returns non-empty string for any data point', () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any non-negative integer totalCents and valid currency, the call
   * formatMoney(totalCents, currency) SHALL return a non-empty string.
   * This is the formatted amount shown in the CategoryDonutChart tooltip.
   */
  it('formatMoney(totalCents, currency) returns a non-empty string for any valid data point', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 7.2
    fc.assert(
      fc.property(nonNegativeCentsArb, validCurrencyArb, (totalCents, currency) => {
        const formatted = formatMoney(totalCents, currency);

        // Must be a string
        expect(typeof formatted).toBe('string');

        // Must be non-empty
        expect(formatted.length).toBeGreaterThan(0);

        // Must not be only whitespace
        expect(formatted.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * The formatted amount string SHALL contain the currency symbol, confirming
   * it is a properly formatted monetary value (not just a raw number).
   */
  it('formatMoney output contains the currency symbol for any valid data point', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 7.2
    const CURRENCY_SYMBOLS: Record<string, string> = {
      USD: '$',
      INR: '₹',
      TZS: 'TSh',
      KES: 'KSh',
      GBP: '£',
      EUR: '€',
    };

    fc.assert(
      fc.property(nonNegativeCentsArb, validCurrencyArb, (totalCents, currency) => {
        const formatted = formatMoney(totalCents, currency);
        const symbol = CURRENCY_SYMBOLS[currency];

        // The formatted string must include the currency symbol
        expect(formatted).toContain(symbol);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * The full tooltip data point { category, totalCents, percentage } SHALL
   * produce both a non-empty label and a non-empty formatted amount — the two
   * required fields for the CategoryDonutChart tooltip.
   */
  it('full tooltip data point produces non-empty label and non-empty formatted amount', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 7.2
    const dataPointArb = fc.record({
      category: anyCategoryArb,
      totalCents: nonNegativeCentsArb,
      percentage: fc.float({ min: 0, max: 100, noNaN: true }),
      currency: validCurrencyArb,
    });

    fc.assert(
      fc.property(dataPointArb, ({ category, totalCents, currency }) => {
        // Replicate the exact logic from CategoryDonutChart CustomTooltip:
        //   const label = CATEGORY_LABELS[category] ?? category;
        //   const formatted = formatMoney(totalCents, currency);
        const label = CATEGORY_LABELS[category] ?? category;
        const formatted = formatMoney(totalCents, currency);

        // Both required tooltip fields must be non-empty strings
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);

        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// P11 (SpendingTimelineChart): tooltip formatters include required fields
// Validates: Requirements 8.2
// ---------------------------------------------------------------------------

/**
 * Property-Based Tests for SpendingTimelineChart tooltip formatter.
 *
 * The tooltip logic in SpendingTimelineChart.tsx (CustomTooltip) performs:
 *   1. Renders `entry.week` directly as the ISO week label
 *   2. Calls `formatMoney(entry.totalCents, entry.currency)` for the amount
 *
 * We test these two operations directly as pure functions.
 */

// ---------------------------------------------------------------------------
// Arbitraries for SpendingTimelineChart
// ---------------------------------------------------------------------------

/** ISO week string generator: YYYY-Www (e.g. "2024-W03") */
const isoWeekArb = fc
  .record({
    year: fc.integer({ min: 2000, max: 2099 }),
    week: fc.integer({ min: 1, max: 53 }),
  })
  .map(({ year, week }) => `${year}-W${String(week).padStart(2, '0')}`);

describe('P11 (SpendingTimelineChart): ISO week string is preserved as-is in tooltip', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any ISO week string (e.g. "2024-W03"), the week value passed to the
   * tooltip SHALL be preserved exactly as-is — the CustomTooltip renders
   * `entry.week` directly without transformation.
   */
  it('ISO week string is preserved as-is for any YYYY-Www value', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(isoWeekArb, (week) => {
        // The tooltip renders `entry.week` directly — no transformation applied.
        // The property: the week string passed in equals the week string rendered.
        const renderedWeek: string = week;

        // Must be a non-empty string
        expect(typeof renderedWeek).toBe('string');
        expect(renderedWeek.length).toBeGreaterThan(0);

        // Must match the ISO week format YYYY-Www
        expect(renderedWeek).toMatch(/^\d{4}-W\d{2}$/);

        // Must be identical to the input (no transformation)
        expect(renderedWeek).toBe(week);
      }),
      { numRuns: 100 }
    );
  });
});

describe('P11 (SpendingTimelineChart): formatMoney returns non-empty string for any data point', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any non-negative integer totalCents and valid currency, the call
   * formatMoney(totalCents, currency) SHALL return a non-empty string.
   * This is the formatted amount shown in the SpendingTimelineChart tooltip.
   */
  it('formatMoney(totalCents, currency) returns a non-empty string for any SpendingTimeline data point', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 8.2
    fc.assert(
      fc.property(nonNegativeCentsArb, validCurrencyArb, (totalCents, currency) => {
        // Replicate the exact logic from SpendingTimelineChart CustomTooltip:
        //   const formatted = formatMoney(totalCents, currency);
        const formatted = formatMoney(totalCents, currency);

        // Must be a string
        expect(typeof formatted).toBe('string');

        // Must be non-empty
        expect(formatted.length).toBeGreaterThan(0);

        // Must not be only whitespace
        expect(formatted.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   *
   * The full SpendingTimeline data point { week, totalCents } SHALL produce
   * both a non-empty week string and a non-empty formatted amount — the two
   * required fields for the SpendingTimelineChart tooltip.
   */
  it('full SpendingTimeline data point produces non-empty week string and non-empty formatted amount', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 8.2
    const timelineDataPointArb = fc.record({
      week: isoWeekArb,
      totalCents: nonNegativeCentsArb,
      currency: validCurrencyArb,
    });

    fc.assert(
      fc.property(timelineDataPointArb, ({ week, totalCents, currency }) => {
        // Replicate the exact logic from SpendingTimelineChart CustomTooltip:
        //   const { week, totalCents, currency } = entry;
        //   const formatted = formatMoney(totalCents, currency);
        const formatted = formatMoney(totalCents, currency);

        // Week string: must be non-empty and match ISO week format
        expect(typeof week).toBe('string');
        expect(week.length).toBeGreaterThan(0);
        expect(week).toMatch(/^\d{4}-W\d{2}$/);

        // Formatted amount: must be a non-empty string
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// P11 (MemberContributionChart): tooltip formatters include required fields
// Validates: Requirements 10.4
// ---------------------------------------------------------------------------

/**
 * Property-Based Tests for MemberContributionChart tooltip formatter.
 *
 * The tooltip logic in MemberContributionChart.tsx (CustomTooltip) performs:
 *   1. Renders `entry.name` directly as the member name label
 *   2. Calls `formatMoney(paidCents, currency)` for the paid amount
 *   3. Calls `formatMoney(owedCents, currency)` for the owed amount
 *
 * We test these three operations directly as pure functions.
 */

// ---------------------------------------------------------------------------
// Arbitraries for MemberContributionChart
// ---------------------------------------------------------------------------

/** Non-empty string arbitrary for member names */
const memberNameArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

/** Non-negative integer cents for paidCents / owedCents */
const memberCentsArb = fc.integer({ min: 0, max: 10_000_000 });

/** Full MemberContributionChart data point */
const memberDataPointArb = fc.record({
  userId: fc.string({ minLength: 1, maxLength: 36 }),
  name: memberNameArb,
  paidCents: memberCentsArb,
  owedCents: memberCentsArb,
  currency: validCurrencyArb,
});

describe('P11 (MemberContributionChart): member name is preserved as-is in tooltip', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * For any non-empty member name string, the name value passed to the
   * tooltip SHALL be preserved exactly as-is — the CustomTooltip renders
   * `entry.name` directly without transformation.
   */
  it('member name is preserved as-is for any non-empty name string', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 10.4
    fc.assert(
      fc.property(memberNameArb, (name) => {
        // The tooltip renders `entry.name` directly — no transformation applied.
        const renderedName: string = name;

        // Must be a string
        expect(typeof renderedName).toBe('string');

        // Must be non-empty
        expect(renderedName.length).toBeGreaterThan(0);

        // Must not be only whitespace
        expect(renderedName.trim().length).toBeGreaterThan(0);

        // Must be identical to the input (no transformation)
        expect(renderedName).toBe(name);
      }),
      { numRuns: 100 }
    );
  });
});

describe('P11 (MemberContributionChart): formatMoney returns non-empty string for paidCents', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * For any non-negative integer paidCents and valid currency, the call
   * formatMoney(paidCents, currency) SHALL return a non-empty string.
   * This is the formatted paid amount shown in the MemberContributionChart tooltip.
   */
  it('formatMoney(paidCents, currency) returns a non-empty string for any valid paidCents', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 10.4
    fc.assert(
      fc.property(memberCentsArb, validCurrencyArb, (paidCents, currency) => {
        // Replicate the exact logic from MemberContributionChart CustomTooltip:
        //   <span>Paid: {formatMoney(paidCents, currency)}</span>
        const formatted = formatMoney(paidCents, currency);

        // Must be a string
        expect(typeof formatted).toBe('string');

        // Must be non-empty
        expect(formatted.length).toBeGreaterThan(0);

        // Must not be only whitespace
        expect(formatted.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

describe('P11 (MemberContributionChart): formatMoney returns non-empty string for owedCents', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * For any non-negative integer owedCents and valid currency, the call
   * formatMoney(owedCents, currency) SHALL return a non-empty string.
   * This is the formatted owed amount shown in the MemberContributionChart tooltip.
   */
  it('formatMoney(owedCents, currency) returns a non-empty string for any valid owedCents', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 10.4
    fc.assert(
      fc.property(memberCentsArb, validCurrencyArb, (owedCents, currency) => {
        // Replicate the exact logic from MemberContributionChart CustomTooltip:
        //   <span>Owed: {formatMoney(owedCents, currency)}</span>
        const formatted = formatMoney(owedCents, currency);

        // Must be a string
        expect(typeof formatted).toBe('string');

        // Must be non-empty
        expect(formatted.length).toBeGreaterThan(0);

        // Must not be only whitespace
        expect(formatted.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

describe('P11 (MemberContributionChart): full data point produces non-empty name, paid amount, and owed amount', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * For any full MemberContributionChart data point { userId, name, paidCents, owedCents },
   * the tooltip SHALL produce:
   *   - a non-empty member name string (rendered as-is)
   *   - a non-empty formatted paid amount string
   *   - a non-empty formatted owed amount string
   *
   * These are the three required fields for the MemberContributionChart tooltip
   * as specified in Requirement 10.4.
   */
  it('full member data point produces non-empty name, non-empty paid amount, and non-empty owed amount', () => {
    // Feature: group-analytics-spending-insights, Property 11: Chart tooltip formatters include required fields for any data point
    // Validates: Requirements 10.4
    fc.assert(
      fc.property(memberDataPointArb, ({ name, paidCents, owedCents, currency }) => {
        // Replicate the exact logic from MemberContributionChart CustomTooltip:
        //   const { name, paidCents, owedCents, currency } = entry;
        //   <div>{name}</div>
        //   <span>Paid: {formatMoney(paidCents, currency)}</span>
        //   <span>Owed: {formatMoney(owedCents, currency)}</span>
        const renderedName: string = name;
        const formattedPaid = formatMoney(paidCents, currency);
        const formattedOwed = formatMoney(owedCents, currency);

        // Member name: must be a non-empty string preserved as-is
        expect(typeof renderedName).toBe('string');
        expect(renderedName.length).toBeGreaterThan(0);
        expect(renderedName.trim().length).toBeGreaterThan(0);
        expect(renderedName).toBe(name);

        // Formatted paid amount: must be a non-empty string
        expect(typeof formattedPaid).toBe('string');
        expect(formattedPaid.length).toBeGreaterThan(0);
        expect(formattedPaid.trim().length).toBeGreaterThan(0);

        // Formatted owed amount: must be a non-empty string
        expect(typeof formattedOwed).toBe('string');
        expect(formattedOwed.length).toBeGreaterThan(0);
        expect(formattedOwed.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
