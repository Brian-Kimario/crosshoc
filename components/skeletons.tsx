import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the Expense Feed while loading */
export function ExpenseFeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-2/3 bg-slate-700" />
              <Skeleton className="h-3 w-1/3 bg-slate-700/60" />
            </div>
            <Skeleton className="h-7 w-20 bg-slate-700" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28 bg-slate-700/60" />
            <Skeleton className="h-8 w-32 bg-slate-700/60 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the Balance Summary card */
export function BalanceSummarySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full bg-slate-700" />
            <Skeleton className="h-4 w-24 bg-slate-700" />
          </div>
          <Skeleton className="h-4 w-20 bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the "Who pays whom" card */
export function DebtsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20 bg-slate-700" />
            <Skeleton className="h-4 w-16 bg-slate-700" />
            <Skeleton className="h-4 w-20 bg-slate-700" />
          </div>
          <Skeleton className="h-9 w-full rounded-xl bg-slate-700/60" />
        </div>
      ))}
    </div>
  );
}
