"use client";

import useSWR from "swr";
import { TrendingUp, TrendingDown } from "lucide-react";
import { keys } from "@/lib/swr-keys";
import { formatMoney } from "@/lib/money-utils";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/chart-theme";
import { DailyTrendChart } from "@/components/analytics/DailyTrendChart";

interface InsightsResponse {
  thisMonthTotalCents: number;
  lastMonthTotalCents: number;
  monthChangePercent: number | null;
  topCategories: Array<{ category: string; totalCents: number }>;
  dailyTrend: Array<{ date: string; totalCents: number }>;
  groupSpending: Array<{
    groupId: string;
    groupName: string;
    spentCents: number;
    currency: string;
  }>;
}

export function DashboardInsights() {
  const { data, error, isLoading } = useSWR<InsightsResponse>(
    keys.dashboardInsights()
  );

  // Return null while loading to avoid layout shift (Req 14.2 / design doc)
  if (isLoading) return null;

  // Return null on error to avoid disrupting the dashboard layout (Req 14.1 / design doc)
  if (error) return null;

  // Return null when there is no spending this month (Req 14.2)
  if (!data || data.thisMonthTotalCents === 0) return null;

  const { thisMonthTotalCents, monthChangePercent, topCategories, dailyTrend, groupSpending } = data;

  // Determine trend indicator properties (Req 14.4, 14.5, 14.6)
  const showTrend = monthChangePercent != null;
  const isPositiveTrend = showTrend && monthChangePercent! > 0;

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 w-full min-w-0">
      {/* Header: total spent + trend indicator */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm text-slate-500 mb-1">Spent this month</p>
          <p className="text-2xl font-semibold text-slate-100">
            {formatMoney(thisMonthTotalCents)}
          </p>
        </div>

        {/* Trend indicator — omitted when monthChangePercent is null (Req 14.4) */}
        {showTrend && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
              isPositiveTrend
                ? "bg-rose-500/10 text-rose-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {isPositiveTrend ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>
              {isPositiveTrend
                ? `+${monthChangePercent!.toFixed(1)}%`
                : `${monthChangePercent!.toFixed(1)}%`}
            </span>
          </div>
        )}
      </div>

      {/* Daily trend chart (Req 14.7) */}
      <div className="mb-5">
        <DailyTrendChart data={dailyTrend} currency="USD" height={120} />
      </div>

      {/* Top categories list (Req 14.8) */}
      {topCategories?.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Top Categories</h3>
          <div className="space-y-2">
            {topCategories.map(({ category, totalCents }) => {
              const color = CATEGORY_COLORS[category] ?? "#6b7280";
              const label = CATEGORY_LABELS[category] ?? category;
              return (
                <div key={category} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Color dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-slate-300 truncate">{label}</span>
                  </div>
                  <span className="text-sm text-slate-400 shrink-0">
                    {formatMoney(totalCents)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-group spending breakdown (Req 14.9) */}
      {groupSpending?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">By Group</h3>
          <div className="space-y-2">
            {groupSpending.map(({ groupId, groupName, spentCents, currency }) => (
              <div key={groupId} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300 truncate">{groupName}</span>
                <span className="text-sm text-slate-400 shrink-0">
                  {formatMoney(spentCents, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
