"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Download, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

interface AuditLog {
  _id: string;
  action: string;
  actorName: string;
  actorId: string;
  groupId?: string;
  resourceId?: string;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

const ACTION_COLORS: Record<string, string> = {
  "expense.created":           "text-teal-400",
  "expense.edited":            "text-amber-400",
  "expense.deleted":           "text-rose-400",
  "expense.voided":            "text-rose-400",
  "expense.admin_voided":      "text-rose-400",
  "settlement.created":        "text-blue-400",
  "settlement.confirmed":      "text-emerald-400",
  "settlement.disputed":       "text-rose-400",
  "settlement.admin_resolved": "text-violet-400",
  "settlement.admin_voided":   "text-rose-400",
  "user.enable":               "text-emerald-400",
  "user.disable":              "text-amber-400",
  "user.make-admin":           "text-violet-400",
  "user.remove-admin":         "text-rose-400",
  "user.deleted":              "text-rose-400",
  "group.created":             "text-teal-400",
  "group.archived":            "text-amber-400",
  "group.restored":            "text-emerald-400",
  "group.admin_deleted":       "text-rose-400",
  "member.added":              "text-teal-400",
  "member.removed":            "text-amber-400",
  "member.admin_removed":      "text-rose-400",
};

export default function AdminAuditLogPage() {
  const [logs,         setLogs]         = useState<AuditLog[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter,  setActorFilter]  = useState("");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");
  const [loading,      setLoading]      = useState(true);
  const [exporting,    setExporting]    = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p = new URLSearchParams({ page: String(page) });
      if (actionFilter) p.set("action", actionFilter);
      if (actorFilter)  p.set("actor",  actorFilter);
      if (fromDate)     p.set("from",   new Date(fromDate).toISOString());
      if (toDate)       p.set("to",     new Date(toDate + "T23:59:59").toISOString());
      Object.entries(overrides).forEach(([k, v]) => p.set(k, v));
      return p;
    },
    [page, actionFilter, actorFilter, fromDate, toDate]
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/audit-log?${buildParams()}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [buildParams]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const params = buildParams({ export: "csv", limit: "5000", page: "1" });
      const res  = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json();
      const rows = (data.logs ?? []).map((l: AuditLog) => [
        new Date(l.timestamp).toISOString(),
        l.action,
        l.actorName ?? "",
        l.groupId?.toString() ?? "",
        l.resourceId?.toString() ?? "",
        l.ipAddress ?? "",
      ]);
      const headers = ["Timestamp", "Action", "Actor", "GroupId", "ResourceId", "IP Address"];
      const csv = [
        headers.join(","),
        ...rows.map((r: string[]) =>
          r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `audit-log-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const hasFilters = !!(actionFilter || actorFilter || fromDate || toDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Audit Log</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} total entries</p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-2 text-xs text-slate-400 border border-[#1E293B] px-3 py-2 rounded-lg hover:bg-[#1E293B] hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Action filter */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            placeholder="Filter by action..."
            className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
          />
        </div>

        {/* Actor filter */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => { setActorFilter(e.target.value); setPage(1); }}
            placeholder="Filter by actor..."
            className="w-full bg-[#0B1120] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-[#334155] transition-colors"
          />
        </div>

        {/* Date range — From */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 shrink-0">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5 text-slate-300 text-xs outline-none focus:border-[#10B981] transition-colors"
          />
        </div>

        {/* Date range — To */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 shrink-0">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5 text-slate-300 text-xs outline-none focus:border-[#10B981] transition-colors"
          />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
              setActionFilter("");
              setActorFilter("");
              setPage(1);
            }}
            className="text-slate-500 text-xs hover:text-slate-300 border border-[#334155] px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {["", "Timestamp", "Actor", "Action", "Resource", "IP", "Time"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-600 mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpandable = !!(log.before || log.after);
                  const isExpanded   = expandedRows.has(log._id);

                  return (
                    <>
                      <tr
                        key={log._id}
                        onClick={() => { if (isExpandable) toggleRow(log._id); }}
                        className={`border-b border-[#1E293B]/60 transition-colors ${
                          isExpandable
                            ? "cursor-pointer hover:bg-[#1E293B]/40"
                            : "hover:bg-[#1E293B]/20"
                        }`}
                      >
                        {/* Expand indicator */}
                        <td className="pl-4 pr-1 py-3 w-6">
                          {isExpandable ? (
                            isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          ) : null}
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3 text-sm text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        {/* Actor */}
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {log.actorName}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${ACTION_COLORS[log.action] ?? "text-slate-400"}`}>
                            {log.action}
                          </span>
                        </td>

                        {/* Resource — clickable link when groupId present */}
                        <td className="px-4 py-3 text-sm font-mono truncate max-w-[150px]">
                          {log.resourceId ? (
                            log.groupId ? (
                              <Link
                                href={`/admin/groups/${log.groupId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-teal-400 hover:text-teal-300 transition-colors"
                              >
                                {log.resourceId.toString().slice(-8)}
                              </Link>
                            ) : (
                              <span className="text-slate-500">
                                {log.resourceId.toString().slice(-8)}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>

                        {/* IP */}
                        <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                          {log.ipAddress ?? "—"}
                        </td>

                        {/* Time ago */}
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {timeAgo(log.timestamp)}
                        </td>
                      </tr>

                      {/* Expanded diff row */}
                      {isExpanded && (
                        <tr key={`${log._id}-diff`} className="bg-[#080E1A]">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                              {!!log.before && (
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">Before</p>
                                  <pre className="text-xs text-rose-300 bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                    {JSON.stringify(log.before, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {!!log.after && (
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">After</p>
                                  <pre className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                    {JSON.stringify(log.after, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
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
