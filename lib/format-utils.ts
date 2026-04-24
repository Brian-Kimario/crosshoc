// Synchronous formatting utilities (no "use server")
// These can be used directly in JSX without await

export type SupportedCurrency = 'USD' | 'INR' | 'TZS';

export const CURRENCY_META: Record<SupportedCurrency, { symbol: string; locale: string; code: string }> = {
  USD: { symbol: '$',   locale: 'en-US', code: 'USD' },
  INR: { symbol: '₹',  locale: 'en-IN', code: 'INR' },
  TZS: { symbol: 'Tsh', locale: 'sw-TZ', code: 'TZS' },
};

/**
 * Format a number as currency using Intl.NumberFormat.
 * Falls back to USD if currency is not recognised.
 */
export function formatCurrency(amount: number, currency: SupportedCurrency | string = 'USD'): string {
  const meta = CURRENCY_META[currency as SupportedCurrency];
  if (!meta) return `${currency} ${amount.toFixed(2)}`;

  // TZS has no sub-unit in common usage
  if (currency === 'TZS') {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Return just the currency symbol for a given currency code */
export function getCurrencySymbol(currency: SupportedCurrency | string = 'USD'): string {
  return CURRENCY_META[currency as SupportedCurrency]?.symbol ?? currency;
}

export function getBalanceColorClass(balance: number): string {
  if (balance > 0) return 'text-emerald-500';
  if (balance < 0) return 'text-rose-500';
  return 'text-slate-400';
}

export function getBalanceBgClass(balance: number): string {
  if (balance > 0) return 'bg-emerald-500/10 border-emerald-500/30';
  if (balance < 0) return 'bg-rose-500/10 border-rose-500/30';
  return 'bg-slate-500/10 border-slate-500/30';
}
