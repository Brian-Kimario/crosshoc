"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Bug, Lightbulb, CheckCircle, Loader2, Inbox } from "lucide-react";

interface FeedbackItem {
  _id: string;
  message: string;
  category: "bug" | "feature" | "general";
  read: boolean;
  createdAt: string;
  userId?: { name: string; email: string } | null;
}

const CATEGORY_CONFIG = {
  bug:     { label: "Bug",     icon: Bug,            color: "text-rose-400",  bg: "bg-rose-500/10"  },
  feature: { label: "Feature", icon: Lightbulb,      color: "text-amber-400", bg: "bg-amber-500/10" },
  general: { label: "General", icon: MessageSquare,  color: "text-blue-400",  bg: "bg-blue-500/10"  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminFeedbackPage() {
  const [items, setItems]         = useState<FeedbackItem[]>([]);
  const [unreadCount, setUnread]  = useState(0);
  const [loading, setLoading]     = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory]   = useState<string>("");
  const [marking, setMarking]     = useState<string | null>(null);

  async function fetchFeedback() {
    setLoading(true);
    const params = new URLSearchParams();
    if (unreadOnly) params.set("unread", "true");
    if (category)   params.set("category", category);
    const res  = await fetch(`/api/admin/feedback?${params}`);
    const data = await res.json();
    setItems(data.feedback ?? []);
    setUnread(data.unreadCount ?? 0);
    setLoading(false);
  }

  useEffect(() => { fetchFeedback(); }, [unreadOnly, category]); // eslint-disable-line

  async function markRead(id: string) {
    setMarking(id);
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMarking(null);
    fetchFeedback();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Feedback Inbox</h1>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? (
              <span className="text-amber-400">{unreadCount} unread</span>
            ) : (
              "All caught up"
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            unreadOnly
              ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
              : "bg-[#1E293B] text-slate-400 hover:text-slate-200"
          }`}
        >
          Unread only
        </button>
        {(["", "bug", "feature", "general"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              category === c
                ? "bg-[#1E293B] text-slate-100 border border-[#334155]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {c === "" ? "All" : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-8 text-center">
          <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No feedback yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = CATEGORY_CONFIG[item.category];
            const Icon = cfg.icon;
            return (
              <div
                key={item._id}
                className={`bg-[#0F172A] border rounded-xl p-4 transition-colors ${
                  item.read ? "border-[#1E293B]" : "border-violet-500/30 bg-violet-500/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {!item.read && (
                        <span className="text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                      <span className="text-xs text-slate-600">{timeAgo(item.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{item.message}</p>
                    {item.userId && (
                      <p className="text-xs text-slate-500 mt-1">
                        From: {item.userId.name} ({item.userId.email})
                      </p>
                    )}
                  </div>
                  {!item.read && (
                    <button
                      onClick={() => markRead(item._id)}
                      disabled={marking === item._id}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#1E293B] text-slate-500 hover:text-emerald-400 transition-colors disabled:opacity-40 shrink-0"
                      title="Mark as read"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
