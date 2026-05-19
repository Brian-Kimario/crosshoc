"use client";

import useSWR from "swr";
import {
  TrendingUp,
  Receipt,
  Calculator,
  Trophy,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { keys } from "@/lib/swr-keys";
import { formatMoney } from "@/lib/money-utils";
import { BudgetCard } from "@/components/analytics/BudgetCard";
import { CategoryDonutChart } from "@/components/analytics/CategoryDonutChart";
import { SpendingTimelineChart } from "@/components/analytics/SpendingTimelineChart";
import { MemberContributionChart } from "@/components/analytics/MemberContributionChart";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "all";

interface AnalyticsResponse {
  period: Period;
  currency: string;
  totalSpentCents: number;
  totalExpenses: number;
  avgExpenseCents: number;
  largestExpense: { description: string; amountCents: number } | null;
  categoryBreakdown: Array<{
    category: string;
    totalCents: number;
    percentage: number;
  }>;
  timeline: Array<{ week: string; totalCents: number }>;
  memberBreakdown: Array<{
    userId: string;
    name: string;
    paidCents: number;
    owedCents: number;
  }>;
  budgetUtilization: {
    limitCents: number;
    spentCents: number;
    usedPercent: number;
    remainingCents: number;
    isOverBudget: boolean;
  } | null;
}

interface GroupAnalyticsPanelProps {
  groupId: string;
  currency: string;
  currentUserId: string;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetcher(url: string): Promise<AnalyticsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch analytics: ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

// ─── Period selector config ───────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GroupAnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Period selector skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-14 rounded-lg bg-slate-700/60" />
        ))}
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-2"
          >
            <div className="h-3 w-16 rounded bg-slate-700/60" />
            <div className="h-6 w-24 rounded bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Budget card skeleton */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
        <div className="h-4 w-20 rounded bg-slate-700/60" />
        <div className="h-2 w-full rounded-full bg-slate-700/60" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-12 rounded bg-slate-700/60 mx-auto" />
              <div className="h-5 w-16 rounded bg-slate-700 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Charts skeleton — two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3"
          >
            <div className="h-4 w-32 rounded bg-slate-700/60" />
            <div className="h-56 w-full rounded-lg bg-slate-700/40" />
          </div>
        ))}
      </div>

      {/* Member chart skeleton */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
        <div className="h-4 w-40 rounded bg-slate-700/60" />
        <div className="h-48 w-full rounded-lg bg-slate-700/40" />
      </div>

      {/* Largest expense callout skeleton */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-2">
        <div className="h-3 w-28 rounded bg-slate-700/60" />
        <div className="h-5 w-48 rounded bg-slate-700" />
        <div className="h-4 w-20 rounded bg-slate-700/60" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GroupAnalyticsPanel({
  groupId,
  currency,
  currentUserId,
}: GroupAnalyticsPanelProps) {
  const [period, setPeriod] = useState<Period>("30d");

  const { data, error, isLoading, mutate } = useSWR<AnalyticsResponse>(
    keys.groupAnalytics(groupId, period),
    fetcher
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return <GroupAnalyticsSkeleton />;
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-rose-800/40 bg-rose-950/30 p-6 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400" />
        <div>
          <p className="text-sm font-medium text-rose-300 mb-1">
            Failed to load analytics
          </p>
          <p className="text-xs text-rose-400/70">
            Something went wrong while fetching spending data.
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-sm font-medium rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // ── Data loaded ────────────────────────────────────────────────────────────
  const analytics = data!;
  const effectiveCurrency = analytics.currency ?? currency;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              period === value
                ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                : "bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total spent */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Total Spent</span>
          </div>
          <p className="text-lg font-semibold text-slate-100 truncate">
            {formatMoney(analytics.totalSpentCents, effectiveCurrency)}
          </p>
        </div>

        {/* Number of expenses */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Expenses</span>
          </div>
          <p className="text-lg font-semibold text-slate-100">
            {analytics.totalExpenses}
          </p>
        </div>

        {/* Average expense */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-slate-400">Average</span>
          </div>
          <p className="text-lg font-semibold text-slate-100 truncate">
            {formatMoney(analytics.avgExpenseCents, effectiveCurrency)}
          </p>
        </div>

        {/* Largest expense */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Largest</span>
          </div>
          {analytics.largestExpense ? (
            <>
              <p className="text-lg font-semibold text-slate-100 truncate">
                {formatMoney(
                  analytics.largestExpense.amountCents,
                  effectiveCurrency
                )}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {analytics.largestExpense.description}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-slate-500">—</p>
          )}
        </div>
      </div>

      {/* Budget card */}
      <BudgetCard
        budgetUtilization={analytics.budgetUtilization}
        groupId={groupId}
        currency={effectiveCurrency}
        period={period}
      />

      {/* Charts — two-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category donut chart */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            Spending by Category
          </h3>
          <CategoryDonutChart
            data={analytics.categoryBreakdown}
            currency={effectiveCurrency}
            size="md"
          />
        </div>

        {/* Spending timeline chart */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            Weekly Spending
          </h3>
          <SpendingTimelineChart
            data={analytics.timeline}
            currency={effectiveCurrency}
          />
        </div>
      </div>

      {/* Member contribution chart */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <h3 className="text-sm font-medium text-slate-300 mb-4">
          Member Contributions
        </h3>
        <MemberContributionChart
          data={analytics.memberBreakdown}
          currency={effectiveCurrency}
          currentUserId={currentUserId}
        />
      </div>

      {/* Largest expense callout card */}
      {analytics.largestExpense && (
        <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-amber-400/80 uppercase tracking-wide mb-1">
                Largest Expense
              </p>
              <p className="text-sm font-semibold text-slate-200 truncate">
                {analytics.largestExpense.description}
              </p>
              <p className="text-lg font-bold text-amber-300 mt-0.5">
                {formatMoney(
                  analytics.largestExpense.amountCents,
                  effectiveCurrency
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
