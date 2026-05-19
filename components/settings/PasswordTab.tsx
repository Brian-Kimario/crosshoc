"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle, ShieldCheck } from "lucide-react";

// ─── Strength scoring ─────────────────────────────────────────────────────────

interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
}

function getStrength(password: string): StrengthResult {
  if (password.length === 0) {
    return { score: 0, label: "", color: "" };
  }
  if (password.length < 6) {
    return { score: 1, label: "Too short", color: "#F43F5E" };
  }

  // Count extra categories beyond just having length >= 6
  let extras = 0;
  if (/[A-Z]/.test(password)) extras++;
  if (/[0-9]/.test(password)) extras++;
  if (/[^A-Za-z0-9]/.test(password)) extras++;

  if (extras === 0) return { score: 2, label: "Weak",   color: "#F59E0B" };
  if (extras === 1) return { score: 3, label: "Fair",   color: "#F59E0B" };
  if (extras === 2) return { score: 4, label: "Good",   color: "#10B981" };
  return               { score: 5, label: "Strong", color: "#10B981" };
}

// ─── Strength bar ─────────────────────────────────────────────────────────────

function StrengthBar({ strength }: { strength: StrengthResult }) {
  if (strength.score === 0) return null;

  // 5 segments; fill up to score
  const segments = [1, 2, 3, 4, 5];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {segments.map((seg) => (
          <div
            key={seg}
            className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor:
                seg <= strength.score ? strength.color : "#334155",
            }}
          />
        ))}
      </div>
      <p
        className="text-xs font-medium transition-colors duration-300"
        style={{ color: strength.color }}
      >
        {strength.label}
      </p>
    </div>
  );
}

// ─── Password field with show/hide toggle ─────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ fontSize: "16px" }}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 pr-11 text-slate-200 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          style={{ minHeight: "44px" }}
          className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PasswordTab() {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [submitting, setSubmitting]   = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const strength = getStrength(newPass);

  // Derived validation
  const anyEmpty      = !currentPass || !newPass || !confirmPass;
  const mismatch      = confirmPass.length > 0 && newPass !== confirmPass;
  const weakPassword  = strength.score < 2;
  const submitDisabled =
    submitting || anyEmpty || weakPassword || newPass !== confirmPass;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
        // Redirect to login after 2500ms
        setTimeout(() => {
          window.location.href = "/login?message=password-changed";
        }, 2500);
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
          <ShieldCheck className="size-8 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">
            Password changed
          </h3>
          <p className="text-sm text-slate-400">
            You have been signed out of all devices. Redirecting to login…
          </p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Current password */}
      <PasswordField
        id="currentPassword"
        label="Current password"
        value={currentPass}
        onChange={setCurrentPass}
        placeholder="Enter your current password"
        autoComplete="current-password"
      />

      {/* New password + strength bar */}
      <div className="space-y-3">
        <PasswordField
          id="newPassword"
          label="New password"
          value={newPass}
          onChange={setNewPass}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
        <StrengthBar strength={strength} />
        {newPass.length > 0 && newPass.length < 8 && strength.score >= 2 && (
          <p className="text-xs text-amber-400">
            Use at least 8 characters for a stronger password.
          </p>
        )}
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          value={confirmPass}
          onChange={setConfirmPass}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
        />
        {mismatch && (
          <p className="text-xs text-rose-400">Passwords do not match.</p>
        )}
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
        {submitting ? "Changing password…" : "Change password"}
      </button>

      <p className="text-xs text-slate-500">
        Changing your password will sign you out of all other devices.
      </p>

    </form>
  );
}
