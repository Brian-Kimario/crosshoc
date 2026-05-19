"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";

const PREFS = [
  {
    key: "expense_added",
    label: "New expenses",
    desc: "When someone adds an expense you're part of",
  },
  {
    key: "expense_deleted",
    label: "Deleted expenses",
    desc: "When an expense you're part of is removed",
  },
  {
    key: "settlement_made",
    label: "Payment requests",
    desc: "When someone records a payment to you",
  },
  {
    key: "settlement_confirmed",
    label: "Payment confirmations",
    desc: "When your payment is confirmed by the recipient",
  },
  {
    key: "settlement_disputed",
    label: "Payment disputes",
    desc: "When someone disputes your payment",
  },
  {
    key: "member_joined",
    label: "New members",
    desc: "When someone joins your group",
  },
  {
    key: "invite_expiring",
    label: "Expiring invite links",
    desc: "When your invite link is about to expire",
  },
  {
    key: "debt_reminder",
    label: "Debt reminders",
    desc: "Periodic reminder if you have unsettled debts",
  },
] as const;

type PrefKey = (typeof PREFS)[number]["key"];

export function NotificationPreferences() {
  const [prefs,   setPrefs]   = useState<Record<string, boolean>>({});
  const [saving,  setSaving]  = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/notification-prefs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setPrefs(d.data?.prefs ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggle = async (key: PrefKey, value: boolean) => {
    setSaving(key);
    setPrefs((prev) => ({ ...prev, [key]: value }));

    await fetch("/api/user/notification-prefs", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    }).catch(() => {
      // Revert on failure
      setPrefs((prev) => ({ ...prev, [key]: !value }));
    });

    setSaving(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-slate-800/50 border border-slate-700 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="size-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">Notification preferences</h3>
      </div>

      {PREFS.map(({ key, label, desc }) => {
        const enabled = prefs[key] !== false;
        const isSaving = saving === key;

        return (
          <div
            key={key}
            className="flex items-center justify-between gap-4 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>

            {/* Toggle switch */}
            <button
              role="switch"
              aria-checked={enabled}
              aria-label={`Toggle ${label}`}
              onClick={() => toggle(key, !enabled)}
              disabled={isSaving}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 ${
                enabled ? "bg-emerald-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
              {isSaving && (
                <Loader2 className="absolute inset-0 m-auto size-3.5 text-white animate-spin" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
