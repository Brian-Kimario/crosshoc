// Synchronous formatting utilities (no "use server")
// These can be used directly in JSX without await

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function getBalanceColorClass(balance: number): string {
  if (balance > 0) return "text-emerald-500";
  if (balance < 0) return "text-rose-500";
  return "text-slate-400";
}

export function getBalanceBgClass(balance: number): string {
  if (balance > 0) return "bg-emerald-500/10 border-emerald-500/30";
  if (balance < 0) return "bg-rose-500/10 border-rose-500/30";
  return "bg-slate-500/10 border-slate-500/30";
}
