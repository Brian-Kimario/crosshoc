"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  X,
  Loader2,
  LogOut,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses a user-agent string and returns a device type and browser name.
 */
export function parseUserAgent(ua: string): { device: string; browser: string } {
  if (!ua || ua === "Unknown") {
    return { device: "unknown", browser: "Unknown Browser" };
  }

  // Device detection
  let device = "desktop";
  if (/mobile|android.*mobile|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    device = "mobile";
  } else if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    device = "tablet";
  }

  // Browser detection
  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    browser = "Opera";
  } else if (/chrome\/[\d.]+/i.test(ua) && !/chromium/i.test(ua)) {
    browser = "Chrome";
  } else if (/firefox\/[\d.]+/i.test(ua)) {
    browser = "Firefox";
  } else if (/safari\/[\d.]+/i.test(ua) && !/chrome/i.test(ua)) {
    browser = "Safari";
  } else if (/msie|trident/i.test(ua)) {
    browser = "Internet Explorer";
  }

  return { device, browser };
}

/**
 * Returns a human-readable relative time string.
 */
export function timeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;

  if (diffMs < 60_000) return "Just now";

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ─── Device Icon ──────────────────────────────────────────────────────────────

function DeviceIcon({ device, className }: { device: string; className?: string }) {
  if (device === "mobile") return <Smartphone className={className} />;
  if (device === "tablet") return <Tablet className={className} />;
  if (device === "desktop") return <Monitor className={className} />;
  return <Globe className={className} />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SessionsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4"
        >
          <div className="size-9 rounded-lg bg-slate-700 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-slate-700" />
            <div className="h-3 w-48 rounded bg-slate-700" />
            <div className="h-3 w-24 rounded bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: Session;
  revoking: string | null;
  onRevoke: (sessionId: string) => void;
}

function SessionCard({ session, revoking, onRevoke }: SessionCardProps) {
  const { device, browser } = parseUserAgent(session.userAgent);
  const isRevoking = revoking === session.sessionId;

  return (
    <div
      className={`
        flex items-start gap-3 rounded-xl border p-4 transition-colors
        ${
          session.isCurrent
            ? "border-teal-500/40 bg-teal-500/5"
            : "border-slate-700 bg-slate-800/50"
        }
      `}
    >
      {/* Device icon */}
      <div
        className={`
          flex size-9 shrink-0 items-center justify-center rounded-lg
          ${session.isCurrent ? "bg-teal-500/20 text-teal-400" : "bg-slate-700 text-slate-400"}
        `}
      >
        <DeviceIcon device={device} className="size-5" />
      </div>

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-200">{browser}</span>
          {session.isCurrent && (
            <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-400 border border-teal-500/30">
              This device
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-400 truncate">
          {session.ipAddress}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Last active {timeAgo(session.lastSeenAt)} · Signed in {timeAgo(session.createdAt)}
        </p>
      </div>

      {/* Revoke button — only for non-current sessions */}
      {!session.isCurrent && (
        <button
          type="button"
          onClick={() => onRevoke(session.sessionId)}
          disabled={isRevoking}
          aria-label="Revoke session"
          style={{ minHeight: "44px" }}
          className="flex shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-700/50 px-3 text-slate-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRevoking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionsTab() {
  const { data, isLoading, mutate } = useSWR<{ sessions: Session[] }>(
    "/api/user/sessions"
  );

  const [revoking, setRevoking]           = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const sessions = data?.sessions ?? [];

  // ── Revoke single session ──────────────────────────────────────────────────

  async function handleRevoke(sessionId: string) {
    setError(null);
    setRevoking(sessionId);

    try {
      const res = await fetch(`/api/user/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to revoke session. Please try again.");
      } else {
        await mutate();
      }
    } catch {
      setError("Failed to revoke session. Please check your connection.");
    } finally {
      setRevoking(null);
    }
  }

  // ── Sign out all others ────────────────────────────────────────────────────

  async function handleSignOutAll() {
    setError(null);
    setSigningOutAll(true);

    try {
      const res = await fetch("/api/user/sessions/all", {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Failed to sign out other sessions. Please try again.");
      } else {
        await mutate();
      }
    } catch {
      setError("Failed to sign out other sessions. Please check your connection.");
    } finally {
      setSigningOutAll(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <SessionsSkeleton />;
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <h2 className="text-sm font-medium text-slate-300">Active sessions</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          These devices are currently signed in to your account.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          <X className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No active sessions found.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              revoking={revoking}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}

      {/* Sign out all others — only when more than 1 session */}
      {sessions.length > 1 && (
        <div className="border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={handleSignOutAll}
            disabled={signingOutAll}
            style={{ minHeight: "44px", fontSize: "16px" }}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOutAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {signingOutAll ? "Signing out…" : "Sign out all other devices"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            This will sign out all devices except this one.
          </p>
        </div>
      )}

    </div>
  );
}
