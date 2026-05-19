"use client";

import useSWR from "swr";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { keys } from "@/lib/swr-keys";
import { formatMoney } from "@/lib/money-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupBreakdown {
  groupId: string;
  groupName: string;
  balanceCents: number;
}

interface ConsolidatedDebt {
  userId: string;
  userName: string;
  netCents: number; // positive = they owe me, negative = I owe them
  groups: GroupBreakdown[];
}

interface ConsolidatedDebtsResponse {
  consolidatedDebts: ConsolidatedDebt[];
  totalOwedToMeCents: number;
  totalIOweCents: number;
  groupCount: number;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DebtRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[#1E293B]/50 animate-pulse">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-[#334155] shrink-0" />
        <div className="h-4 bg-[#334155] rounded w-28" />
      </div>
      <div className="h-4 bg-[#334155] rounded w-16 shrink-0" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConsolidatedDebts() {
  const { data, error, isLoading } = useSWR<ConsolidatedDebtsResponse>(
    keys.consolidatedDebts()
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(userId: string) {
    setExpandedId((prev) => (prev === userId ? null : userId));
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 w-full min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-100">Consolidated Debts</h2>
        </div>
        <div className="space-y-2">
          <DebtRowSkeleton />
          <DebtRowSkeleton />
          <DebtRowSkeleton />
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 w-full min-w-0">
        <h2 className="text-lg font-medium text-slate-100 mb-2">Consolidated Debts</h2>
        <p className="text-sm text-slate-500">Could not load debt summary.</p>
      </div>
    );
  }

  const debts = data?.consolidatedDebts ?? [];

  // ── Empty state ──
  if (debts.length === 0) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 w-full min-w-0">
        <h2 className="text-lg font-medium text-slate-100 mb-4">Consolidated Debts</h2>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-3 text-2xl">
            ✓
          </div>
          <p className="text-sm text-slate-500">All settled up across all groups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-slate-100">Consolidated Debts</h2>
        <span className="text-xs px-2 py-1 rounded-lg bg-[#1E293B] text-slate-400 shrink-0">
          {data?.groupCount ?? 0} group{(data?.groupCount ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Summary totals */}
      {((data?.totalOwedToMeCents ?? 0) > 0 || (data?.totalIOweCents ?? 0) > 0) && (
        <div className="flex gap-3 mb-4">
          {(data?.totalOwedToMeCents ?? 0) > 0 && (
            <div className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">You're owed</p>
              <p className="text-sm font-medium text-emerald-400 truncate">
                {formatMoney(data!.totalOwedToMeCents, "USD")}
              </p>
            </div>
          )}
          {(data?.totalIOweCents ?? 0) > 0 && (
            <div className="flex-1 px-3 py-2 rounded-lg bg-rose-500/10 min-w-0">
              <p className="text-xs text-slate-500 mb-0.5">You owe</p>
              <p className="text-sm font-medium text-rose-400 truncate">
                {formatMoney(data!.totalIOweCents, "USD")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Debt rows */}
      <div className="space-y-1">
        {debts.map((debt) => {
          const isExpanded = expandedId === debt.userId;
          const isPositive = debt.netCents >= 0;
          const balanceColor = isPositive ? "text-emerald-400" : "text-rose-400";
          const balanceBg = isPositive ? "bg-emerald-500/10" : "bg-rose-500/10";
          const initials = debt.userName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div key={debt.userId} className="rounded-xl overflow-hidden">
              {/* Row button */}
              <button
                onClick={() => toggleExpand(debt.userId)}
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-[#1E293B] transition-colors text-left min-h-[56px] tap-feedback"
                aria-expanded={isExpanded}
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#1E293B] flex items-center justify-center text-xs font-medium text-slate-300 shrink-0">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {debt.userName}
                  </span>
                </div>

                {/* Net balance + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-sm font-medium px-2.5 py-1 rounded-lg ${balanceBg} ${balanceColor}`}
                  >
                    {isPositive ? "+" : ""}
                    {formatMoney(debt.netCents, "USD")}
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expandable per-group breakdown */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="breakdown"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1 bg-[#0A1628]">
                      <p className="text-xs text-slate-500 pt-2 pb-1 uppercase tracking-wide">
                        Per group
                      </p>
                      {debt.groups.map((g) => {
                        const gPositive = g.balanceCents >= 0;
                        return (
                          <div
                            key={g.groupId}
                            className="flex items-center justify-between gap-3 py-2 border-b border-[#1E293B] last:border-0"
                          >
                            <span className="text-sm text-slate-400 truncate min-w-0">
                              {g.groupName}
                            </span>
                            <span
                              className={`text-sm font-medium shrink-0 ${
                                gPositive ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {gPositive ? "+" : ""}
                              {formatMoney(g.balanceCents, "USD")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
