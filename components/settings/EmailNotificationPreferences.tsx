"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";

const EMAIL_PREFS = [
  {
    key: "newLogin",
    label: "New login alerts",
    desc: "When your account is accessed from a new device or location",
  },
  {
    key: "groupInvite",
    label: "Group invitations",
    desc: "When someone invites you to join a group",
  },
  {
    key: "inviteExpiringSoon",
    label: "Expiring invitations",
    desc: "When a group invitation you created is about to expire",
  },
  {
    key: "expenseVoided",
    label: "Voided expenses",
    desc: "When an admin voids an expense you're part of",
  },
  {
    key: "settlementVoided",
    label: "Voided settlements",
    desc: "When an admin voids a settlement you're part of",
  },
  {
    key: "removedFromGroup",
    label: "Removed from group",
    desc: "When an admin removes you from a group",
  },
  {
    key: "groupDeleted",
    label: "Group deleted",
    desc: "When an admin deletes a group you're a member of",
  },
] as const;

type EmailPrefKey = (typeof EMAIL_PREFS)[number]["key"];

export function EmailNotificationPreferences() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/email-prefs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setPrefs(d.emailPrefs ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggle = async (key: EmailPrefKey, value: boolean) => {
    setSaving(key);
    setPrefs((prev) => ({ ...prev, [key]: value }));

    await fetch("/api/user/email-prefs", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
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
        <Mail className="size-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">Email notification preferences</h3>
      </div>

      {EMAIL_PREFS.map(({ key, label, desc }) => {
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

      <p className="text-xs text-slate-500 pt-2 px-1">
        Security-critical emails (account changes, password resets) are always sent.
      </p>
    </div>
  );
}
