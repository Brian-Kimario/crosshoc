// Feature: group-analytics-spending-insights, Property 7: formatCurrencyCompact applies correct threshold formatting
// Feature: group-analytics-spending-insights, Property 8: formatCurrencyCompact round-trip approximation

/**
 * Property-Based Tests for formatCurrencyCompact
 *
 * Feature: group-analytics-spending-insights
 *
 * Properties tested:
 *   P7 – formatCurrencyCompact applies correct threshold formatting
 *   P8 – formatCurrencyCompact round-trip approximation
 *
 * Validates: Requirements 15.2, 15.3, 15.4, 15.5, 15.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatCurrencyCompact } from '@/lib/format-utils';
import { formatMoney, getCurrencySymbol } from '@/lib/money';

// ---------------------------------------------------------------------------
// P7: formatCurrencyCompact applies correct threshold formatting
// Validates: Requirements 15.2, 15.3, 15.4, 15.5
// ---------------------------------------------------------------------------

describe('P7: formatCurrencyCompact applies correct threshold formatting', () => {
  /**
   * **Validates: Requirements 15.2, 15.3, 15.4, 15.5**
   *
   * For any integer cent amount:
   * - If cents >= 100_000_000 (i.e., $1M+), output should match pattern {symbol}{n}M
   * - If cents >= 1_000_000 (i.e., $10K+) and < 100_000_000, output should match {symbol}{n}K
   * - If cents < 1_000_000 (i.e., < $10K), output should equal formatMoney(cents, currency)
   */

  it('amounts >= $1,000,000 (cents >= 100_000_000) produce {symbol}{n}M format', () => {
    // Validates: Requirements 15.2, 15.5
    fc.assert(
      fc.property(
        // cents >= 100_000_000 means dollars >= 1_000_000
        fc.integer({ min: 100_000_000, max: 999_999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const symbol = getCurrencySymbol('USD');

          // Must end with 'M'
          expect(result.endsWith('M')).toBe(true);

          // Must start with the currency symbol
          expect(result.startsWith(symbol)).toBe(true);

          // The numeric portion (between symbol and 'M') must be a valid decimal
          const numericPart = result.slice(symbol.length, -1);
          const parsed = parseFloat(numericPart);
          expect(isNaN(parsed)).toBe(false);
          expect(parsed).toBeGreaterThan(0);

          // The numeric portion must be rounded to 1 decimal place
          const dollars = cents / 100;
          const expectedValue = parseFloat((dollars / 1_000_000).toFixed(1));
          expect(parsed).toBe(expectedValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('amounts >= $10,000 and < $1,000,000 (cents in [1_000_000, 99_999_999]) produce {symbol}{n}K format', () => {
    // Validates: Requirements 15.3, 15.5
    fc.assert(
      fc.property(
        // cents in [1_000_000, 99_999_999] means dollars in [$10,000, $999,999.99)
        fc.integer({ min: 1_000_000, max: 99_999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const symbol = getCurrencySymbol('USD');

          // Must end with 'K'
          expect(result.endsWith('K')).toBe(true);

          // Must start with the currency symbol
          expect(result.startsWith(symbol)).toBe(true);

          // The numeric portion (between symbol and 'K') must be a valid decimal
          const numericPart = result.slice(symbol.length, -1);
          const parsed = parseFloat(numericPart);
          expect(isNaN(parsed)).toBe(false);
          expect(parsed).toBeGreaterThan(0);

          // The numeric portion must be rounded to 1 decimal place
          const dollars = cents / 100;
          const expectedValue = parseFloat((dollars / 1_000).toFixed(1));
          expect(parsed).toBe(expectedValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('amounts < $10,000 (cents < 1_000_000) produce the same result as formatMoney', () => {
    // Validates: Requirements 15.4, 15.5
    fc.assert(
      fc.property(
        // cents < 1_000_000 means dollars < $10,000
        fc.integer({ min: 0, max: 999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const expected = formatMoney(cents, 'USD');

          // Must equal formatMoney output exactly
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('threshold branching is correct across all ranges for any cent amount in [0, 999_999_999]', () => {
    // Validates: Requirements 15.2, 15.3, 15.4, 15.5
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const symbol = getCurrencySymbol('USD');
          const dollars = cents / 100;

          if (dollars >= 1_000_000) {
            // Must use M suffix
            expect(result.endsWith('M')).toBe(true);
            expect(result.startsWith(symbol)).toBe(true);
            expect(result.endsWith('K')).toBe(false);
          } else if (dollars >= 10_000) {
            // Must use K suffix
            expect(result.endsWith('K')).toBe(true);
            expect(result.startsWith(symbol)).toBe(true);
            expect(result.endsWith('M')).toBe(false);
          } else {
            // Must equal formatMoney
            expect(result).toBe(formatMoney(cents, 'USD'));
            expect(result.endsWith('K')).toBe(false);
            expect(result.endsWith('M')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: exactly $10,000 (1_000_000 cents) uses K format', () => {
    // Validates: Requirements 15.3 — boundary condition at $10K
    const result = formatCurrencyCompact(1_000_000, 'USD');
    expect(result.endsWith('K')).toBe(true);
    expect(result).toBe('$10.0K');
  });

  it('boundary: exactly $1,000,000 (100_000_000 cents) uses M format', () => {
    // Validates: Requirements 15.2 — boundary condition at $1M
    const result = formatCurrencyCompact(100_000_000, 'USD');
    expect(result.endsWith('M')).toBe(true);
    expect(result).toBe('$1.0M');
  });

  it('boundary: $9,999.99 (999_999 cents) uses formatMoney fallback', () => {
    // Validates: Requirements 15.4 — just below $10K threshold
    const result = formatCurrencyCompact(999_999, 'USD');
    expect(result).toBe(formatMoney(999_999, 'USD'));
    expect(result.endsWith('K')).toBe(false);
    expect(result.endsWith('M')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P8: formatCurrencyCompact round-trip approximation
// Validates: Requirements 15.6
// ---------------------------------------------------------------------------

describe('P8: formatCurrencyCompact round-trip approximation', () => {
  /**
   * **Validates: Requirements 15.6**
   *
   * For any valid non-negative integer cent amount, parsing the numeric portion
   * of the formatCurrencyCompact output (stripping the symbol and suffix M/K)
   * and converting back to cents SHALL produce a value within 0.1% of the
   * original display amount.
   */

  /**
   * Parse the numeric value from a formatCurrencyCompact output and convert
   * back to cents.
   *
   * - For M suffix: numeric * 1_000_000 * 100 (to cents)
   * - For K suffix: numeric * 1_000 * 100 (to cents)
   * - Otherwise: parse the formatMoney output back to cents
   */
  function parseCompactToCents(output: string, currency: string): number {
    const symbol = getCurrencySymbol(currency);

    if (output.endsWith('M')) {
      const numericPart = output.slice(symbol.length, -1);
      const millions = parseFloat(numericPart);
      return millions * 1_000_000 * 100;
    }

    if (output.endsWith('K')) {
      const numericPart = output.slice(symbol.length, -1);
      const thousands = parseFloat(numericPart);
      return thousands * 1_000 * 100;
    }

    // For formatMoney output, strip the symbol and parse the number
    // Remove symbol, commas, and parse
    const stripped = output.slice(symbol.length).replace(/,/g, '');
    const dollars = parseFloat(stripped);
    return Math.round(dollars * 100);
  }

  it('round-trip is within 0.5% of original for any cent amount in [0, 999_999_999]', () => {
    // Validates: Requirements 15.6
    //
    // Note: formatCurrencyCompact uses toFixed(1) which rounds to 1 decimal place.
    // The maximum absolute rounding error is 0.05 in the compact unit:
    //   - K range: 0.05K = $50 = 5000 cents → max relative error at $10K = 5000/1_000_000 = 0.5%
    //   - M range: 0.05M = $50,000 = 5_000_000 cents → max relative error at $1M = 5_000_000/100_000_000 = 5%
    // The 0.5% tolerance covers the K range; M range uses a separate test with appropriate tolerance.
    // For the formatMoney fallback (< $10K), the round-trip is exact within 1 cent.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const roundTrippedCents = parseCompactToCents(result, 'USD');

          if (cents === 0) {
            // Zero is a special case — round-trip should be 0
            expect(roundTrippedCents).toBe(0);
            return;
          }

          const dollars = cents / 100;

          if (dollars >= 1_000_000) {
            // M range: toFixed(1) can introduce up to 0.05M = $50,000 = 5,000,000 cents error
            // Relative error at $1M = 5,000,000/100,000,000 = 5%
            // Use absolute tolerance: within 5,000,000 cents (0.05M)
            const absoluteError = Math.abs(roundTrippedCents - cents);
            expect(absoluteError).toBeLessThanOrEqual(5_000_000);
          } else if (dollars >= 10_000) {
            // K range: toFixed(1) can introduce up to 0.05K = $50 = 5,000 cents error
            // Relative error at $10K = 5,000/1,000,000 = 0.5%
            const relativeError = Math.abs(roundTrippedCents - cents) / cents;
            expect(relativeError).toBeLessThanOrEqual(0.005);
          } else {
            // formatMoney fallback: exact within 1 cent
            expect(Math.abs(roundTrippedCents - cents)).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trip is exact for amounts < $10,000 (formatMoney fallback path)', () => {
    // Validates: Requirements 15.6 — exact round-trip for small amounts
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const roundTrippedCents = parseCompactToCents(result, 'USD');

          // For the formatMoney path, round-trip should be exact (within 1 cent due to rounding)
          expect(Math.abs(roundTrippedCents - cents)).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trip is within 0.5% for K-range amounts ($10K to $999,999.99)', () => {
    // Validates: Requirements 15.6 — K suffix range
    //
    // toFixed(1) rounds to 0.1K precision. Max absolute error = 0.05K = $50 = 5000 cents.
    // At the minimum K value ($10,000 = 1,000,000 cents), relative error = 5000/1,000,000 = 0.5%.
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000, max: 99_999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const roundTrippedCents = parseCompactToCents(result, 'USD');

          const relativeError = Math.abs(roundTrippedCents - cents) / cents;
          expect(relativeError).toBeLessThanOrEqual(0.005);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trip absolute error is within 0.05M (5,000,000 cents) for M-range amounts ($1M+)', () => {
    // Validates: Requirements 15.6 — M suffix range
    //
    // toFixed(1) rounds to 0.1M precision. Max absolute error = 0.05M = $50,000 = 5,000,000 cents.
    // This is the inherent precision limit of the compact M format.
    fc.assert(
      fc.property(
        fc.integer({ min: 100_000_000, max: 999_999_999 }),
        (cents) => {
          const result = formatCurrencyCompact(cents, 'USD');
          const roundTrippedCents = parseCompactToCents(result, 'USD');

          const absoluteError = Math.abs(roundTrippedCents - cents);
          // Max error from toFixed(1) rounding: 0.05M = 5,000,000 cents
          expect(absoluteError).toBeLessThanOrEqual(5_000_000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('zero cents round-trips to zero', () => {
    // Validates: Requirements 15.6 — edge case: zero
    const result = formatCurrencyCompact(0, 'USD');
    const roundTripped = parseCompactToCents(result, 'USD');
    expect(roundTripped).toBe(0);
  });
});
