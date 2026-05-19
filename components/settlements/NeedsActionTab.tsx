"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Paperclip, Bell } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money-utils";
import type { Settlement } from "@/hooks/use-settlements";

interface NeedsActionTabProps {
  settlements: Settlement[];
  onActionComplete: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function SettlementActionCard({
  settlement,
  onActionComplete,
}: {
  settlement: Settlement;
  onActionComplete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [disputing,  setDisputing]  = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason]     = useState("");

  const currency = settlement.group.currency || "USD";

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/settlements/${settlement._id}/confirm`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to confirm"); return; }
      toast.success("Payment confirmed — balance updated");
      onActionComplete();
    } catch {
      toast.error("Failed to confirm payment");
    } finally {
      setConfirming(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) { toast.error("Please enter a reason"); return; }
    setDisputing(true);
    try {
      const res = await fetch(`/api/settlements/${settlement._id}/dispute`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to dispute"); return; }
      toast.success("Dispute recorded — payer has been notified");
      onActionComplete();
    } catch {
      toast.error("Failed to dispute payment");
    } finally {
      setDisputing(false);
    }
  };

  return (
    <div className="bg-[#0F172A] border border-amber-500/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
            {(settlement.fromUser?.name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">
              <span className="text-amber-300">{settlement.fromUser?.name ?? "Someone"}</span>
              {" "}paid you
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {settlement.group.name}
              {" · "}
              <span className="capitalize">{settlement.method}</span>
              {" · "}
              {timeAgo(settlement.createdAt ?? settlement.settledAt)}
            </p>
          </div>
        </div>
        <span className="text-lg font-bold text-amber-400 shrink-0">
          {formatMoney(settlement.amount, currency)}
        </span>
      </div>

      {/* Note */}
      {settlement.note && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-400 italic bg-[#1E293B] rounded-lg px-3 py-2">
            &ldquo;{settlement.note}&rdquo;
          </p>
        </div>
      )}

      {/* Proof link */}
      {settlement.proofUrl && (
        <div className="px-4 pb-3">
          <a
            href={settlement.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5"
          >
            <Paperclip className="size-3" />
            View proof screenshot
          </a>
        </div>
      )}

      {/* Dispute form */}
      {showDisputeForm && (
        <div className="px-4 pb-3 space-y-2">
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Explain why you're disputing this payment…"
            rows={2}
            className="w-full rounded-lg bg-[#1E293B] border border-rose-500/30 text-slate-200 text-sm px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-rose-500/60 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDispute}
              disabled={disputing}
              className="flex-1 py-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 text-sm font-medium hover:bg-rose-500/30 transition-colors disabled:opacity-50"
            >
              {disputing ? "Submitting…" : "Submit dispute"}
            </button>
            <button
              onClick={() => { setShowDisputeForm(false); setDisputeReason(""); }}
              className="px-4 py-2 rounded-lg bg-[#1E293B] text-slate-400 text-sm hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showDisputeForm && (
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <CheckCircle className="size-4" />
            {confirming ? "Confirming…" : "Confirm — yes I received it"}
          </button>
          <button
            onClick={() => setShowDisputeForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-sm font-medium hover:bg-rose-500/10 transition-colors"
          >
            <XCircle className="size-4" />
            Dispute
          </button>
        </div>
      )}
    </div>
  );
}

export function NeedsActionTab({ settlements, onActionComplete }: NeedsActionTabProps) {
  if (settlements.length === 0) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-10 text-center">
        <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="size-7 text-emerald-500" />
        </div>
        <h3 className="text-base font-medium text-slate-200 mb-1">All caught up</h3>
        <p className="text-sm text-slate-500">No payments waiting for your confirmation</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Bell className="size-4 text-amber-400" />
        <p className="text-sm text-amber-300 font-medium">
          {settlements.length} payment{settlements.length !== 1 ? "s" : ""} waiting for your confirmation
        </p>
      </div>
      {settlements.map((s) => (
        <SettlementActionCard
          key={s._id}
          settlement={s}
          onActionComplete={onActionComplete}
        />
      ))}
    </div>
  );
}
