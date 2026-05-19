"use client";

import { useState } from "react";
import { Clock, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money-utils";
import type { Settlement } from "@/hooks/use-settlements";

interface PendingTabProps {
  settlements: Settlement[];
  onActionComplete: () => void;
}

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PendingCard({
  settlement,
  onActionComplete,
}: {
  settlement: Settlement;
  onActionComplete: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const currency = settlement.group.currency || "USD";
  const sentAt = settlement.createdAt ?? settlement.settledAt;

  const handleCancel = async () => {
    if (!confirm("Cancel this payment record? This cannot be undone.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/settlements/${settlement._id}/cancel`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to cancel"); return; }
      toast.success("Payment cancelled");
      onActionComplete();
    } catch {
      toast.error("Failed to cancel payment");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#1E293B] flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
            {(settlement.toUser?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">
              You paid{" "}
              <span className="text-emerald-300">{settlement.toUser?.name ?? "someone"}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {settlement.group.name}
              {" · "}
              <span className="capitalize">{settlement.method}</span>
            </p>
          </div>
        </div>
        <span className="text-base font-bold text-slate-100 shrink-0">
          {formatMoney(settlement.amount, currency)}
        </span>
      </div>

      {/* Note */}
      {settlement.note && (
        <p className="text-xs text-slate-400 italic bg-[#1E293B] rounded-lg px-3 py-2">
          &ldquo;{settlement.note}&rdquo;
        </p>
      )}

      {/* Proof */}
      {settlement.proofUrl && (
        <a
          href={settlement.proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <Paperclip className="size-3" />
          View proof
        </a>
      )}

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="size-3.5" />
          <span>
            Waiting for {settlement.toUser?.name ?? "recipient"} to confirm
            {" · "}
            Sent {timeAgo(sentAt)}
          </span>
        </div>

        {settlement.canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}

export function PendingTab({ settlements, onActionComplete }: PendingTabProps) {
  if (settlements.length === 0) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-10 text-center">
        <div className="size-14 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
          <Clock className="size-7 text-slate-600" />
        </div>
        <h3 className="text-base font-medium text-slate-200 mb-1">No pending payments</h3>
        <p className="text-sm text-slate-500">
          Payments you&apos;ve submitted will appear here until confirmed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settlements.map((s) => (
        <PendingCard key={s._id} settlement={s} onActionComplete={onActionComplete} />
      ))}
    </div>
  );
}
