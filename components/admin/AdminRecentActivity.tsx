"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditLog {
  _id: string;
  action: string;
  actorName: string;
  resourceId?: string;
  timestamp: string;
}

export function AdminRecentActivity() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-log?page=1")
      .then(r => r.json())
      .then(d => { setLogs(d.logs?.slice(0, 10) ?? []); setLoading(false); });
  }, []);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1)   return "just now";
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const ACTION_COLORS: Record<string, string> = {
    "expense.created":         "text-teal-400",
    "settlement.created":      "text-amber-400",
    "settlement.confirmed":    "text-emerald-400",
    "settlement.disputed":     "text-rose-400",
    "user.deleted":            "text-rose-400",
    "user.disable":            "text-amber-400",
    "settlement.admin_resolved": "text-violet-400",
  };

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl">
      <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Recent Platform Activity
        </h3>
        <Link
          href="/admin/audit-log"
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          View all →
        </Link>
      </div>

      <div className="divide-y divide-[#1E293B]">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-slate-800 animate-pulse" />
              <div className="flex-1 h-4 bg-slate-800 rounded animate-pulse" />
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No activity yet
          </div>
        ) : logs.map(log => (
          <div key={log._id} className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-xs font-medium ${ACTION_COLORS[log.action] ?? "text-slate-400"}`}>
                {log.action}
              </span>
              <span className="text-sm text-slate-500">
                by {log.actorName}
              </span>
            </div>

            <span className="text-xs text-slate-600 shrink-0">
              {timeAgo(log.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
