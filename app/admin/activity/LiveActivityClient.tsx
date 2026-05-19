"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";

// ── Human-readable action labels ──────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  "expense.created":                        "Expense added",
  "expense.edited":                         "Expense edited",
  "expense.deleted":                        "Expense deleted",
  "expense.voided":                         "Expense voided",
  "expense.admin_voided":                   "Admin voided expense",
  "settlement.created":                     "Settlement recorded",
  "settlement.confirmed":                   "Settlement confirmed",
  "settlement.disputed":                    "Settlement disputed",
  "settlement.admin_resolved":              "Admin resolved dispute",
  "settlement.admin_voided":                "Admin voided settlement",
  "member.added":                           "Member joined",
  "member.removed":                         "Member left",
  "member.admin_removed":                   "Admin removed member",
  "group.created":                          "Group created",
  "group.archived":                         "Group archived",
  "group.restored":                         "Group restored",
  "group.admin_deleted":                    "Admin deleted group",
  "user.disable":                           "Account disabled",
  "user.enable":                            "Account enabled",
  "user.make-admin":                        "Admin role granted",
  "user.remove-admin":                      "Admin role removed",
  "user.deleted":                           "Account deleted",
  "user.admin_profile_updated":             "Admin updated profile",
  "user.admin_password_reset_triggered":    "Admin triggered password reset",
};

// ── Color coding by action category ───────────────────────────────────────────
interface ActionColor {
  bg: string;
  text: string;
  dot: string;
}

const ACTION_COLORS: Record<string, ActionColor> = {
  // Expense actions
  "expense.created":           { bg: "#0D2E1F", text: "#34D399", dot: "#10B981" },
  "expense.edited":            { bg: "#1C1A0A", text: "#FCD34D", dot: "#F59E0B" },
  "expense.deleted":           { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  "expense.voided":            { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  "expense.admin_voided":      { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  // Settlement actions
  "settlement.created":        { bg: "#0A1F2E", text: "#7DD3FC", dot: "#3B82F6" },
  "settlement.confirmed":      { bg: "#0D2E1F", text: "#34D399", dot: "#10B981" },
  "settlement.disputed":       { bg: "#2D1A0A", text: "#FDB07A", dot: "#F59E0B" },
  "settlement.admin_resolved": { bg: "#1A0D2E", text: "#C4B5FD", dot: "#8B5CF6" },
  "settlement.admin_voided":   { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  // Group actions
  "group.created":             { bg: "#0D2E1F", text: "#34D399", dot: "#10B981" },
  "group.archived":            { bg: "#1C1A0A", text: "#FCD34D", dot: "#F59E0B" },
  "group.restored":            { bg: "#0D2E1F", text: "#34D399", dot: "#10B981" },
  "group.admin_deleted":       { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  // Member actions
  "member.added":              { bg: "#0D2E1F", text: "#34D399", dot: "#10B981" },
  "member.removed":            { bg: "#1C1A0A", text: "#FCD34D", dot: "#F59E0B" },
  "member.admin_removed":      { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  // User actions
  "user.disable":              { bg: "#2D1A0A", text: "#FDB07A", dot: "#F59E0B" },
  "user.enable":               { bg: "#0D2E1F", text: "#34D399", dot: "#10B981" },
  "user.make-admin":           { bg: "#1A0D2E", text: "#C4B5FD", dot: "#8B5CF6" },
  "user.remove-admin":         { bg: "#1C1A0A", text: "#FCD34D", dot: "#F59E0B" },
  "user.deleted":              { bg: "#2D0A0A", text: "#FCA5A5", dot: "#F43F5E" },
  "user.admin_profile_updated":             { bg: "#1A0D2E", text: "#C4B5FD", dot: "#8B5CF6" },
  "user.admin_password_reset_triggered":    { bg: "#1A0D2E", text: "#C4B5FD", dot: "#8B5CF6" },
};

const DEFAULT_COLOR: ActionColor = { bg: "#1E293B", text: "#94A3B8", dot: "#475569" };

function getColor(action: string): ActionColor {
  return ACTION_COLORS[action] ?? DEFAULT_COLOR;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const MAX_EVENTS = 100;

export function LiveActivityClient() {
  const [events,    setEvents]    = useState<any[]>([]);
  const [newCount,  setNewCount]  = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastPoll,  setLastPoll]  = useState<string | null>(null);
  const sinceRef = useRef(new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/activity/recent?since=${encodeURIComponent(sinceRef.current)}&limit=50`
      );
      if (!res.ok) return;
      const data = await res.json();

      if (data.logs.length > 0) {
        setEvents((prev) => {
          const merged = [...data.logs, ...prev];
          // Deduplicate by _id
          const seen = new Set<string>();
          const deduped = merged.filter((e) => {
            if (seen.has(e._id)) return false;
            seen.add(e._id);
            return true;
          });
          setNewCount((n) => n + data.logs.length);
          return deduped.slice(0, MAX_EVENTS);
        });
      }

      // Advance the since cursor
      sinceRef.current = data.serverTime;
      setLastPoll(new Date().toLocaleTimeString());
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  // Initial load + 10-second poll
  useEffect(() => {
    poll();
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, [poll]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-teal-400" />
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Live Activity</h1>
            <p className="text-sm text-slate-500">
              Incremental polling — updates every 10 seconds
            </p>
          </div>
          {connected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 ml-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
          {newCount > 0 && (
            <span className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
              +{newCount} new
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastPoll && (
            <span className="text-xs text-slate-600">Updated {lastPoll}</span>
          )}
          <button
            onClick={() => {
              sinceRef.current = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              setNewCount(0);
              poll();
            }}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs border border-[#1E293B] px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Connection error */}
      {!connected && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-400">
          ⚠ Connection error — retrying every 10 seconds
        </div>
      )}

      {/* Event feed */}
      {events.length === 0 ? (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-10 text-center">
          <Activity className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No activity in the last 5 minutes</p>
        </div>
      ) : (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#1E293B]/60 max-h-[72vh] overflow-y-auto">
            {events.map((event: any, idx: number) => {
              const color = getColor(event.action);
              const label = ACTION_LABELS[event.action] ?? event.action;
              const isNew = idx < newCount;

              return (
                <div
                  key={event._id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-[#1E293B]/30 transition-colors"
                  style={isNew ? { borderLeft: "2px solid #10B981" } : undefined}
                >
                  {/* Colored dot */}
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: color.dot }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Action badge */}
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: color.bg, color: color.text }}
                      >
                        {label}
                      </span>

                      {/* Actor */}
                      <span className="text-xs text-slate-500">
                        by{" "}
                        <span className="text-slate-300">
                          {event.actorName ?? "System"}
                        </span>
                      </span>

                      {/* Links row */}
                      {event.groupId && (
                        <Link
                          href={`/admin/groups/${event.groupId}`}
                          className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View group
                        </Link>
                      )}
                      {event.resourceId && event.resourceId !== event.groupId?.toString() && (
                        <span className="text-xs text-slate-600 font-mono">
                          {String(event.resourceId).slice(-8)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-slate-600 shrink-0 mt-0.5">
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
