"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, Mail } from "lucide-react";
import useSWR from "swr";
import { keys } from "@/lib/swr-keys";

// ─── SWR fetcher ──────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailTab() {
  const { data, isLoading } = useSWR(keys.profile(), fetcher);

  const currentEmail: string = data?.user?.email ?? "";

  const [newEmail, setNewEmail]           = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword]   = useState(false);

  const [submitting, setSubmitting]       = useState(false);
  const [success, setSuccess]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const submitDisabled =
    submitting || !newEmail.trim() || !currentPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/user/change-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmail.trim().toLowerCase(),
          currentPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
        setNewEmail("");
        setCurrentPassword("");
      }
    } catch {
      setError("Request failed. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20">
          <Mail className="size-8 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">
            Verification email sent
          </h3>
          <p className="text-sm text-slate-400">
            Check your new inbox and click the link to confirm the change.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          style={{ minHeight: "44px", fontSize: "16px" }}
          className="rounded-lg border border-slate-600 px-5 py-2 text-sm text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
        >
          Change a different email
        </button>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Current email — read-only */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-300">Current email</p>
        {isLoading ? (
          <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-700/60" />
        ) : (
          <p className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-400 text-sm select-all">
            {currentEmail || "—"}
          </p>
        )}
      </div>

      {/* New email */}
      <div className="space-y-1.5">
        <label
          htmlFor="newEmail"
          className="block text-sm font-medium text-slate-300"
        >
          New email address
        </label>
        <input
          id="newEmail"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Current password */}
      <div className="space-y-1.5">
        <label
          htmlFor="emailCurrentPassword"
          className="block text-sm font-medium text-slate-300"
        >
          Current password
        </label>
        <div className="relative">
          <input
            id="emailCurrentPassword"
            type={showPassword ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
            autoComplete="current-password"
            style={{ fontSize: "16px" }}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 pr-11 text-slate-200 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{ minHeight: "44px" }}
            className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          <XCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitDisabled}
        style={{ minHeight: "44px", fontSize: "16px" }}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {submitting ? "Sending verification…" : "Change email"}
      </button>

      <p className="text-xs text-slate-500">
        A verification link will be sent to your new email address. Your email
        will not change until you click the link.
      </p>

    </form>
  );
}
