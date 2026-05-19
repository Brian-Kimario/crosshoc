"server only";

/**
 * SplitEasy Money Utilities - Server Only Module
 *
 * This module re-exports pure utilities from money-utils.ts and provides
 * server-only async functions that require database access.
 *
 * Client components should import from @/lib/money-utils instead.
 */

export {
  type CurrencyConfig,
  CURRENCY_CONFIG,
  toCents,
  fromCents,
  formatMoney,
  getCurrencySymbol,
  distributeEvenly,
  distributeByPercentage,
  validateExactSplits,
  centsEqual,
  assertCents,
} from "./money-utils";

/**
 * Convert integer cents from one currency to another using a stored ExchangeRate.
 *
 * - If `fromCurrency === toCurrency`, returns `cents` immediately (no DB call).
 * - If an ExchangeRate record exists for the pair, returns `Math.round(cents * rate)`
 *   to maintain the integer-cents invariant.
 * - If no record is found, logs a warning and returns the original `cents` unchanged.
 *
 * NOTE: This function is async because it may query the database.
 * This is SERVER ONLY - do not import into client components.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4
 */
export async function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return cents;
  }

  const dbConnect = (await import("@/lib/db")).default;
  const ExchangeRate = (await import("@/lib/models/ExchangeRate")).default;

  await dbConnect();

  const record = await ExchangeRate.findOne({
    base: fromCurrency,
    target: toCurrency,
  }).lean();

  if (!record) {
    console.warn(
      `[convertCents] No exchange rate found for ${fromCurrency} → ${toCurrency}. Returning original cents.`
    );
    return cents;
  }

  return Math.round(cents * (record as { rate: number }).rate);
}
