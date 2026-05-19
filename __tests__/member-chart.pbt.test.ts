// Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8

/**
 * Property-Based Tests for MemberContributionChart sort+cap transformation.
 *
 * Feature: group-analytics-spending-insights
 *
 * Properties tested:
 *   P9 – Member contribution chart orders by paid descending and caps at 8
 *
 * Validates: Requirements 10.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// The sort+cap transformation extracted from MemberContributionChart.tsx
// ---------------------------------------------------------------------------

interface MemberBreakdownEntry {
  userId: string;
  name: string;
  paidCents: number;
  owedCents: number;
}

/**
 * Replicates the exact transformation from MemberContributionChart.tsx:
 *
 *   const chartData = data
 *     .slice()
 *     .sort((a, b) => b.paidCents - a.paidCents)
 *     .slice(0, 8)
 */
function applyMemberChartTransformation(data: MemberBreakdownEntry[]): MemberBreakdownEntry[] {
  return data
    .slice()
    .sort((a, b) => b.paidCents - a.paidCents)
    .slice(0, 8);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for a single MemberBreakdownEntry with random paidCents */
const memberEntryArb = fc.record({
  userId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  paidCents: fc.integer({ min: 0, max: 10_000_000 }),
  owedCents: fc.integer({ min: 0, max: 10_000_000 }),
});

/** Arbitrary for a memberBreakdown array of length 0–50 */
const memberBreakdownArb = fc.array(memberEntryArb, { minLength: 0, maxLength: 50 });

// ---------------------------------------------------------------------------
// P9: Member contribution chart orders by paid descending and caps at 8
// Validates: Requirements 10.2
// ---------------------------------------------------------------------------

describe('P9: Member contribution chart orders by paid descending and caps at 8', () => {
  /**
   * **Validates: Requirements 10.2**
   *
   * For any memberBreakdown array of arbitrary length (0–50), the
   * sort+cap transformation SHALL produce a result of length ≤ 8.
   */
  it('result length is always ≤ 8 for any input array', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(memberBreakdownArb, (data) => {
        const result = applyMemberChartTransformation(data);
        expect(result.length).toBeLessThanOrEqual(8);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * For any memberBreakdown array of arbitrary length, the result length
   * SHALL equal min(data.length, 8).
   */
  it('result length equals min(data.length, 8) for any input array', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(memberBreakdownArb, (data) => {
        const result = applyMemberChartTransformation(data);
        const expectedLength = Math.min(data.length, 8);
        expect(result.length).toBe(expectedLength);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * For any memberBreakdown array, the result entries SHALL be ordered by
   * paidCents descending — each entry's paidCents SHALL be ≥ the next
   * entry's paidCents.
   */
  it('result entries are ordered by paidCents descending', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(memberBreakdownArb, (data) => {
        const result = applyMemberChartTransformation(data);

        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].paidCents).toBeGreaterThanOrEqual(result[i + 1].paidCents);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * For any memberBreakdown array, the top 8 members by paidCents SHALL
   * always be included — no member with a higher paidCents is excluded
   * while a member with a lower paidCents is included.
   *
   * Formally: for every member NOT in the result, their paidCents SHALL be
   * ≤ the minimum paidCents of any member in the result.
   */
  it('top 8 members by paidCents are always included (no higher-paid member excluded)', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(memberBreakdownArb, (data) => {
        const result = applyMemberChartTransformation(data);

        // If the result is smaller than the input, verify excluded members
        // have paidCents ≤ the minimum paidCents in the result
        if (result.length < data.length && result.length > 0) {
          const minPaidInResult = Math.min(...result.map((e) => e.paidCents));

          // Identify excluded members (by userId)
          const includedIds = new Set(result.map((e) => e.userId));
          const excluded = data.filter((e) => !includedIds.has(e.userId));

          for (const excludedMember of excluded) {
            expect(excludedMember.paidCents).toBeLessThanOrEqual(minPaidInResult);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * Edge case: empty input array produces an empty result.
   */
  it('empty input produces empty result', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    const result = applyMemberChartTransformation([]);
    expect(result.length).toBe(0);
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * Edge case: input with exactly 8 members returns all 8, ordered descending.
   */
  it('input with exactly 8 members returns all 8 ordered by paidCents descending', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(
        fc.array(memberEntryArb, { minLength: 8, maxLength: 8 }),
        (data) => {
          const result = applyMemberChartTransformation(data);
          expect(result.length).toBe(8);
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].paidCents).toBeGreaterThanOrEqual(result[i + 1].paidCents);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * Edge case: input with more than 8 members is capped at exactly 8.
   */
  it('input with more than 8 members is capped at exactly 8', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(
        fc.array(memberEntryArb, { minLength: 9, maxLength: 50 }),
        (data) => {
          const result = applyMemberChartTransformation(data);
          expect(result.length).toBe(8);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 10.2**
   *
   * The transformation SHALL NOT mutate the original input array.
   */
  it('transformation does not mutate the original input array', () => {
    // Feature: group-analytics-spending-insights, Property 9: Member contribution chart orders by paid descending and caps at 8
    // Validates: Requirements 10.2
    fc.assert(
      fc.property(memberBreakdownArb, (data) => {
        const originalOrder = data.map((e) => e.userId);
        const originalPaidCents = data.map((e) => e.paidCents);

        applyMemberChartTransformation(data);

        // Original array order and values must be unchanged
        expect(data.map((e) => e.userId)).toEqual(originalOrder);
        expect(data.map((e) => e.paidCents)).toEqual(originalPaidCents);
      }),
      { numRuns: 100 }
    );
  });
});
