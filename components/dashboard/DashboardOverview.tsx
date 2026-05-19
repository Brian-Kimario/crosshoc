"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store/ui-store";
import { formatMoney, getCurrencySymbol } from "@/lib/money-utils";
import { useDashboard } from "@/hooks/use-dashboard";
import useSWR from "swr";
import { keys } from "@/lib/swr-keys";
import { DashboardInsights } from "@/components/dashboard/DashboardInsights";
import { ConsolidatedDebts } from "@/components/dashboard/ConsolidatedDebts";

interface DashboardOverviewProps {
  userName?: string;
}

// Stat card skeleton
function StatCardSkeleton() {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-[#1E293B] mb-3" />
      <div className="h-8 bg-[#1E293B] rounded w-16 mb-2" />
      <div className="h-4 bg-[#1E293B] rounded w-24" />
    </div>
  );
}

// Group card skeleton
function GroupCardSkeleton() {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 animate-pulse min-w-0">
      <div className="h-12 w-12 bg-[#1E293B] rounded-xl mb-4" />
      <div className="h-6 bg-[#1E293B] rounded w-1/2 mb-2" />
      <div className="h-4 bg-[#1E293B] rounded w-1/3" />
    </div>
  );
}

export function DashboardOverview({ userName: initialUserName }: DashboardOverviewProps) {
  const { groups, totalOwedToMe, totalIOwe, isLoading, isValidating, error } = useDashboard();
  const { setCreateGroupOpen, setJoinGroupOpen } = useUIStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Fetch current user data on client side
  const { data: userData } = useSWR(keys.profile(), async (url) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.user || null;
  });

  const userName = userData?.name || userData?.email || initialUserName || "there";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only compute greeting and date after mount
  const greeting = mounted ? (() => {
    const h = new Date().getHours();
    const emoji = h < 12 ? "☀️" : h < 17 ? "🌤️" : h < 21 ? "🌆" : "🌙";
    const word =
      h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
    return `Good ${word}, ${userName} ${emoji}`;
  })() : "";

  const today = mounted ? new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }) : "";

  const colors = ["#10B981", "#8B5CF6", "#3B82F6", "#F59E0B"];
  const avatarBgs = ["#134E4A", "#3B0764", "#1E3A5F", "#78350F"];

  return (
    <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0">
      {/* ── Greeting row ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          {mounted ? (
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">
              {greeting}
            </h1>
          ) : (
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">
              Loading...
            </h1>
          )}
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full min-w-0">
        {/* Total Groups */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E293B] flex items-center justify-center text-lg">
              ⊞
            </div>
            <span className="text-xs text-slate-500">All time</span>
          </div>
          <div className="amount-large font-semibold text-slate-100">
            {!mounted || isLoading ? "—" : groups.length}
          </div>
          <div className="text-sm text-slate-500 mt-1">Total groups</div>
          {mounted && !isLoading && groups.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {groups.slice(0, 3).map((g: { _id: string; name: string }) => (
                <span
                  key={g._id}
                  className="text-xs px-2 py-1 rounded-lg bg-[#1E293B] text-slate-400"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Owed to me */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              ↗
            </div>
            <span className="text-xs text-slate-500">Across all groups</span>
          </div>
          {totalOwedToMe > 0 ? (
            <div className="amount-large font-semibold text-emerald-400">
              {totalOwedToMe.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                style: "currency",
                currency: "USD",
              })}
            </div>
          ) : (
            <div className="text-2xl font-semibold text-slate-500">
              ✓ All settled
            </div>
          )}
          <div className="text-sm text-slate-500 mt-1">Others owe you</div>
        </div>

        {/* I owe */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              ↙
            </div>
            <span className="text-xs text-slate-500">Across all groups</span>
          </div>
          {totalIOwe > 0 ? (
            <>
              <div className="amount-large font-semibold text-rose-400">
                {totalIOwe.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  style: "currency",
                  currency: "USD",
                })}
              </div>
              <div className="text-sm text-slate-500 mt-1">You owe others</div>
              <Link
                href="/settlements"
                className="text-sm text-teal-400 hover:text-teal-300 mt-2 flex items-center gap-1"
              >
                Settle up →
              </Link>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold text-slate-500">
                ✓ Nothing owed
              </div>
              <div className="text-sm text-slate-500 mt-1">You owe others</div>
            </>
          )}
        </div>
      </div>

      {/* ── Spending Insights ── */}
      <DashboardInsights />

      {/* ── Your groups grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-100">Your Groups</h2>
          <span className="text-sm px-3 py-1 rounded-full bg-[#1E293B] text-slate-400">
            {groups.length}
          </span>
        </div>

        {isLoading ? (
          /* Skeleton */
          <div className="grid md:grid-cols-2 gap-4 w-full min-w-0">
            {[0, 1].map((i) => (
              <GroupCardSkeleton key={i} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          /* Empty state */
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4 text-3xl sm:text-4xl">
              👥
            </div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              No groups yet
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto leading-relaxed">
              Create a group or join one with an invite link to start splitting expenses
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setCreateGroupOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#10B981] hover:bg-[#059669] text-white font-medium rounded-xl transition-colors tap-feedback"
              >
                + Create group
              </button>
              <button
                onClick={() => setJoinGroupOpen(true)}
                className="w-full sm:w-auto px-5 py-3 bg-[#1E293B] text-slate-300 hover:text-white rounded-xl hover:bg-[#334155] transition-colors tap-feedback"
              >
                Join with link
              </button>
            </div>
          </div>
        ) : (
          /* Group cards */
          <div className="grid md:grid-cols-2 gap-4 w-full min-w-0">
            {groups.map((group, i) => {
              const color = colors[i % colors.length];
              const avatarBg = avatarBgs[i % avatarBgs.length];

              return (
                <Link
                  key={group._id}
                  href={`/groups/${group._id}`}
                  className="bg-[#0F172A] border border-[#1E293B] hover:border-[#334155] rounded-xl p-5 transition-all group min-w-0 overflow-hidden tap-feedback"
                >
                  <div className="flex items-start justify-between mb-4 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-medium"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-100 group-hover:text-teal-400 transition-colors">
                          {group.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {group.members.length} members
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="mb-4">
                    {group.myBalance > 0 ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
                        <span>gets back {formatMoney(Math.round(group.myBalance * 100), group.currency)}</span>
                      </div>
                    ) : group.myBalance < 0 ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push("/settlements");
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-sm hover:bg-rose-500/20 transition-colors"
                      >
                        <span>owes {formatMoney(Math.round(Math.abs(group.myBalance) * 100), group.currency)}</span>
                      </button>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E293B] text-slate-500 text-sm">
                        <span>✓ Settled up</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      {group.expenseCount} expense
                      {group.expenseCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Member avatars */}
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex items-center -space-x-1.5">
                      {group.members.slice(0, 4).map((m: { _id: string; name: string; email: string }, j: number) => (
                        <div
                          key={m._id}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 border-[#0F172A] ${j > 0 ? "-ml-1.5" : ""}`}
                          style={{
                            backgroundColor: avatarBg,
                            color: "#fff",
                          }}
                        >
                          {(m.name || m.email || "?").charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {group.members.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-[#1E293B] flex items-center justify-center text-xs text-slate-400 border-2 border-[#0F172A] -ml-1.5">
                          +{group.members.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-teal-400 group-hover:underline">
                      Open →
                    </span>
                  </div>
                </Link>
              );
            })}

            {/* Add group card */}
            <button
              onClick={() => setCreateGroupOpen(true)}
              className="border-2 border-dashed border-[#334155] rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-[#10B98150] hover:text-teal-500 transition-all min-h-45 cursor-pointer bg-transparent"
            >
              <span className="text-2xl">+</span>
              <span className="font-medium">New group</span>
              <span className="text-xs text-slate-500">
                or join with an invite link
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Consolidated Debts ── */}
      <ConsolidatedDebts />

      {/* ── Recent Activity ── */}
      <RecentActivity />
    </div>
  );
}

// Activity item type
interface ActivityItem {
  id: string;
  type: "expense" | "settlement";
  status?: string;
  icon: string;
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  groupId: string;
  date: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useRecentActivity() {
  const { data, error, isLoading } = useSWR<{ activities: ActivityItem[] }>(
    keys.recentActivity()
  );

  return {
    activities: data?.activities ?? [],
    isLoading,
    error,
  };
}

function RecentActivity() {
  const { activities, isLoading } = useRecentActivity();

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-5 w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-slate-100">Recent Activity</h2>
        {activities.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-lg bg-[#1E293B] text-slate-400 shrink-0">
            {activities.length} items
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#1E293B]/50 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-[#334155]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[#334155] rounded w-1/2" />
                <div className="h-3 bg-[#334155] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-3 text-2xl">
            📋
          </div>
          <p className="text-sm text-slate-500">No activity yet — add your first expense</p>
        </div>
      ) : (
        <div className="space-y-1 w-full min-w-0">
          {activities.map((a: ActivityItem) => (
            <Link
              key={a.id}
              href={`/groups/${a.groupId}`}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1E293B] transition-colors min-h-11 w-full min-w-0"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center text-lg shrink-0">
                {a.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{a.title}</p>
                <p className="text-xs text-slate-500 truncate">{a.subtitle}</p>
              </div>

              {/* Amount + time */}
              <div className="text-right shrink-0 max-w-30">
                {a.amount !== undefined && a.amount > 0 && (
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {getCurrencySymbol(a.currency)}{formatMoney(a.amount, a.currency, { showSymbol: false })}
                  </p>
                )}
                <p className="text-xs text-slate-500">{timeAgo(a.date)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
