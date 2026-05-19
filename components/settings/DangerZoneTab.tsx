"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ─── Component ────────────────────────────────────────────────────────────────

export function DangerZoneTab() {
  const router = useRouter();

  // ── Export state ──────────────────────────────────────────────────────────
  const [exporting, setExporting]       = useState(false);
  const [exportError, setExportError]   = useState<string | null>(null);

  // ── Delete form state ─────────────────────────────────────────────────────
  const [password, setPassword]         = useState("");
  const [confirmText, setConfirmText]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const deleteEnabled =
    confirmText === "DELETE MY ACCOUNT" && password.length > 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleExport() {
    setExportError(null);
    setExporting(true);

    try {
      const res = await fetch("/api/user/export", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setExportError(json.error ?? "Failed to export data. Please try again.");
        return;
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      const anchor      = document.createElement("a");
      anchor.href       = url;
      anchor.download   = "spliteasy-export.json";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      URL.revokeObjectURL(url);
    } catch {
      setExportError("Failed to export data. Please check your connection.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteEnabled) return;

    setDeleteError(null);
    setDeleting(true);

    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmText }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setDeleteError(json.error ?? "Failed to delete account. Please try again.");
        return;
      }

      router.push("/?deleted=true");
    } catch {
      setDeleteError("Failed to delete account. Please check your connection.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Data Export ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-300">Export your data</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Download a copy of all your personal data including profile, groups,
            expenses, and settlements as a JSON file.
          </p>
        </div>

        {exportError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          style={{ minHeight: "44px", fontSize: "16px" }}
          className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {exporting ? "Preparing download…" : "Download my data"}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700" />

      {/* ── Account Deletion ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <AlertTriangle className="size-5 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-rose-400">Delete account</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              This action is permanent and cannot be undone. All your data will be
              deleted immediately. You will be removed from all groups.
            </p>
          </div>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">

          {/* Password field */}
          <div className="space-y-1.5">
            <label
              htmlFor="delete-password"
              className="block text-xs font-medium text-slate-400"
            >
              Confirm your password
            </label>
            <div className="relative">
              <input
                id="delete-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ fontSize: "16px" }}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 pr-10 text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ minHeight: "44px" }}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirmation text field */}
          <div className="space-y-1.5">
            <label
              htmlFor="delete-confirm"
              className="block text-xs font-medium text-slate-400"
            >
              Type{" "}
              <span className="font-mono text-rose-400">DELETE MY ACCOUNT</span>{" "}
              to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              autoComplete="off"
              spellCheck={false}
              style={{ fontSize: "16px" }}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
            />
          </div>

          {/* Inline error */}
          {deleteError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!deleteEnabled || deleting}
            style={{ minHeight: "44px", fontSize: "16px" }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {deleting ? "Deleting account…" : "Delete my account"}
          </button>

        </form>
      </div>

    </div>
  );
}
