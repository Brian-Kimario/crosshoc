"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ArrowLeftRight, Ban } from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";
import Link from "next/link";
import { toast } from "sonner";

interface Settlement {
  _id: string;
  amount: number;
  method: string;
  note?: string;
  status: "pending" | "confirmed" | "disputed" | "voided";
  settledAt: string;
  createdAt: string;
  fromUser: { name: string; email: string } | null;
  toUser:   { name: string; email: string } | null;
  group:    { name: string; currency: string; _id: string } | null;
}

interface StatusCounts {
  pending: number;
  confirmed: number;
  disputed: number;
}

type StatusFilter = "all" | "pending" | "confirmed" | "disputed";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-500/20 text-emerald-400",
  disputed:  "bg-rose-500/20 text-rose-400",
  pending:   "bg-amber-500/20 text-amber-400",
  voided:    "bg-slate-700/50 text-slate-500",
};

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    pending: 0, confirmed: 0, disputed: 0,
  });
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filter !== "all") params.set("status", filter);
    const res  = await fetch(`/api/admin/settlements?${params}`);
    const data = await res.json();
    setSettlements(data.settlements ?? []);
    setStatusCounts(data.statusCounts ?? { pending: 0, confirmed: 0, disputed: 0 });
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  async function voidSettlement(settlementId: string) {
    const reason = window.prompt("Reason for voiding this settlement:");
    if (!reason?.trim()) return;

    setVoidingId(settlementId);
    try {
      const res = await fetch(`/api/admin/settlements/${settlementId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to void settlement");
        return;
      }
      toast.success("Settlement voided");
      setSettlements((prev) =>
        prev.map((s) => s._id === settlementId ? { ...s, status: "voided" } : s)
      );
    } catch {
      toast.error("Failed to void settlement");
    } finally {
      setVoidingId(null);
    }
  }

  const filterTabs: { id: StatusFilter; label: string; count?: number }[] = [
    { id: "all",       label: "All",       count: statusCounts.pending + statusCounts.confirmed + statusCounts.disputed },
    { id: "pending",   label: "Pending",   count: statusCounts.pending },
    { id: "confirmed", label: "Confirmed", count: statusCounts.confirmed },
    { id: "disputed",  label: "Disputed",  count: statusCounts.disputed },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Settlements</h1>
        <p className="text-sm text-slate-500">{total.toLocaleString()} total</p>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(["pending", "confirmed", "disputed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1); }}
            className={`bg-[#0F172A] border rounded-xl p-4 text-left transition-colors hover:border-[#334155] ${
              filter === s ? "border-violet-500/40" : "border-[#1E293B]"
            }`}
          >
            <p className="text-xs text-slate-500 uppercase mb-1 capitalize">{s}</p>
            <p className={`text-2xl font-semibold ${
              s === "confirmed" ? "text-emerald-400" :
              s === "disputed"  ? "text-rose-400"    : "text-amber-400"
            }`}>
              {statusCounts[s]}
            </p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-1 w-fit overflow-x-auto">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setFilter(tab.id); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === tab.id
                ? "bg-[#1E293B] text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[10px] bg-[#334155] text-slate-400 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {["From", "To", "Amount", "Group", "Method", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600 mx-auto" />
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <ArrowLeftRight className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No settlements found</p>
                  </td>
                </tr>
              ) : settlements.map((s) => (
                <tr key={s._id} className={`hover:bg-[#1E293B]/30 transition-colors ${s.status === "voided" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-sm text-slate-300">{s.fromUser?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{s.toUser?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-200">
                    {formatCurrency(s.amount, s.group?.currency ?? "USD")}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {s.group ? (
                      <Link
                        href={`/admin/groups/${s.group._id}`}
                        className="hover:text-violet-400 transition-colors"
                      >
                        {s.group.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 capitalize">{s.method}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[s.status] ?? "text-slate-400"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(s.createdAt ?? s.settledAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {s.status !== "voided" && (
                      <button
                        onClick={() => voidSettlement(s._id)}
                        disabled={voidingId === s._id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                        title="Void settlement"
                      >
                        {voidingId === s._id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 50 && (
          <div className="px-4 py-3 border-t border-[#1E293B] flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs text-slate-400 border border-[#1E293B] rounded-lg hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
                className="px-3 py-1.5 text-xs text-slate-400 border border-[#1E293B] rounded-lg hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
