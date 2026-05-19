"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, Receipt, ChevronDown, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/money-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseRow {
  _id: string;
  description: string;
  amount: number;           // integer cents
  category: string;
  splitType: string;
  createdAt: string;
  receiptUrl?: string;
  isGuest: boolean;
  guestName?: string;
  currency: string;
  group: { _id: string; name: string; currency: string };
  paidBy: { _id: string; name: string } | null;
  splits: { user: { _id: string; name: string }; amount: number }[];
  myShareCents: number;
  status: "paid" | "owed" | "settled";
}

interface Pagination {
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, string> = {
  food: "🍔", rent: "🏠", travel: "✈️", transport: "🚕",
  entertainment: "🎬", grocery: "🛒", other: "🧾",
};

function groupByDate(expenses: ExpenseRow[]): [string, ExpenseRow[]][] {
  const map = new Map<string, ExpenseRow[]>();
  for (const exp of expenses) {
    const key = new Date(exp.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(exp);
  }
  return Array.from(map.entries());
}

function StatusPill({ status }: { status: ExpenseRow["status"] }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-950 text-blue-400 border border-blue-800/50">
        you paid
      </span>
    );
  }
  if (status === "owed") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-950 text-rose-400 border border-rose-800/50">
        you owe
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
      settled
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExpensesFeed() {
  const [expenses, setExpenses]     = useState<ExpenseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch]         = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [groups, setGroups]         = useState<{ id: string; name: string }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchExpenses = useCallback(
    async (page: number, replace: boolean) => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({ page: String(page) });
        if (search.trim())  params.set("search",  search.trim());
        if (groupFilter)    params.set("groupId", groupFilter);

        const res = await fetch(`/api/expenses/mine?${params}`, {
          credentials: "include",
        });
        if (!res.ok) return;

        const json = await res.json();
        const rows: ExpenseRow[] = json.data?.expenses ?? [];
        const pag: Pagination    = json.data?.pagination;

        setExpenses((prev) => replace ? rows : [...prev, ...rows]);
        setPagination(pag);

        // Collect unique groups for filter dropdown
        if (replace) {
          const seen = new Map<string, string>();
          rows.forEach((r) => seen.set(r.group._id, r.group.name));
          setGroups(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [search, groupFilter]
  );

  // Initial + filter-change load
  useEffect(() => {
    fetchExpenses(1, true);
  }, [fetchExpenses]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExpenses(1, true), 350);
  };

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !loadingMore) {
          fetchExpenses(pagination.page + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pagination, loadingMore, fetchExpenses]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const grouped = groupByDate(expenses);

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="pl-8 pr-8 py-2.5 rounded-xl bg-[#0F172A] border border-[#1E293B] text-slate-300 text-sm focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary line */}
      {pagination && !loading && (
        <p className="text-xs text-slate-500">
          {pagination.total} expense{pagination.total !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#1E293B]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#1E293B] rounded w-1/2" />
                  <div className="h-3 bg-[#1E293B] rounded w-1/3" />
                </div>
                <div className="h-5 bg-[#1E293B] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-12 text-center">
          <div className="size-16 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
            <Receipt className="size-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">No expenses found</h3>
          <p className="text-sm text-slate-500">
            {search || groupFilter
              ? "Try adjusting your filters"
              : "Expenses you're involved in will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, rows]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {date}
                </span>
                <div className="flex-1 h-px bg-[#1E293B]" />
              </div>

              {/* Expense rows */}
              <div className="space-y-2">
                {rows.map((exp) => {
                  const icon = CATEGORY_ICON[exp.category?.toLowerCase() ?? "other"] ?? "🧾";
                  const isExpanded = expandedId === exp._id;
                  const paidByName = exp.isGuest && exp.guestName
                    ? `${exp.guestName} (Guest)`
                    : exp.paidBy?.name ?? "Unknown";

                  return (
                    <div
                      key={exp._id}
                      className="bg-[#0F172A] border border-[#1E293B] hover:border-[#334155] rounded-xl overflow-hidden transition-colors"
                    >
                      {/* Main row */}
                      <div className="flex items-center gap-3 p-4">
                        {/* Icon */}
                        <div className="size-10 rounded-xl bg-[#1E293B] flex items-center justify-center text-lg shrink-0">
                          {icon}
                        </div>

                        {/* Description + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-100 truncate">
                              {exp.description}
                            </span>
                            <StatusPill status={exp.status} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-500">{exp.group.name}</span>
                            <span className="text-slate-700">·</span>
                            <span className="text-xs text-slate-500">
                              Paid by {paidByName}
                            </span>
                            {exp.myShareCents > 0 && (
                              <>
                                <span className="text-slate-700">·</span>
                                <span className="text-xs text-slate-400">
                                  Your share:{" "}
                                  <span className={exp.status === "owed" ? "text-rose-400" : "text-slate-300"}>
                                    {formatMoney(exp.myShareCents, exp.currency)}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Amount + expand */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-base font-semibold text-slate-100">
                            {formatMoney(exp.amount, exp.currency)}
                          </span>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : exp._id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1E293B] transition-colors"
                            aria-label={isExpanded ? "Collapse splits" : "Expand splits"}
                          >
                            <ChevronDown
                              className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Expanded splits */}
                      {isExpanded && (
                        <div className="border-t border-[#1E293B] px-4 py-3 space-y-2 bg-[#080D1A]">
                          {exp.splits.length === 0 ? (
                            <p className="text-xs text-slate-500">No split details available.</p>
                          ) : (
                            exp.splits.map((split) => (
                              <div
                                key={split.user._id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-slate-400">{split.user.name}</span>
                                <span className="text-slate-300 font-medium">
                                  {formatMoney(split.amount, exp.currency)}
                                </span>
                              </div>
                            ))
                          )}
                          {exp.receiptUrl && (
                            <a
                              href={exp.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mt-1"
                            >
                              <ExternalLink className="size-3" />
                              View receipt
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="size-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}

          {!pagination?.hasMore && expenses.length > 0 && (
            <p className="text-center text-xs text-slate-600 py-2">
              All expenses loaded
            </p>
          )}
        </div>
      )}
    </div>
  );
}
