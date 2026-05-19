"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Paperclip, History } from "lucide-react";
import { formatMoney } from "@/lib/money-utils";
import type { Settlement } from "@/hooks/use-settlements";

interface HistoryTabProps {
  settlements: Settlement[];
}

function HistoryCard({ settlement }: { settlement: Settlement }) {
  const currency  = settlement.group.currency || "USD";
  const confirmed = settlement.status === "confirmed";

  const dateStr = (settlement.confirmedAt ?? settlement.settledAt);
  const displayDate = new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      className={`bg-[#0F172A] rounded-xl overflow-hidden border-l-4 ${
        confirmed ? "border-l-emerald-500 border-y border-r border-[#1E293B]"
                  : "border-l-rose-500 border-y border-r border-[#1E293B]"
      }`}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Status icon */}
        <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${
          confirmed ? "bg-emerald-500/15" : "bg-rose-500/15"
        }`}>
          {confirmed
            ? <CheckCircle className="size-5 text-emerald-400" />
            : <XCircle    className="size-5 text-rose-400" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-100">
                <span className="text-slate-300">{settlement.fromUser?.name ?? "Someone"}</span>
                {" paid "}
                <span className="text-slate-300">{settlement.toUser?.name ?? "someone"}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {settlement.group.name}
                {" · "}
                {displayDate}
                {" · "}
                <span className={`font-medium ${confirmed ? "text-emerald-400" : "text-rose-400"}`}>
                  {confirmed ? "Confirmed" : "Disputed"}
                </span>
              </p>
            </div>
            <span className={`text-base font-bold shrink-0 ${
              confirmed ? "text-emerald-400" : "text-rose-400"
            }`}>
              {formatMoney(settlement.amount, currency)}
            </span>
          </div>

          {/* Note */}
          {settlement.note && (
            <p className="text-xs text-slate-500 italic mt-2">
              &ldquo;{settlement.note}&rdquo;
            </p>
          )}

          {/* Dispute reason */}
          {!confirmed && settlement.disputeReason && (
            <div className="mt-2 flex items-start gap-1.5">
              <XCircle className="size-3.5 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-300">
                Reason: &ldquo;{settlement.disputeReason}&rdquo;
              </p>
            </div>
          )}

          {/* Proof */}
          {settlement.proofUrl && (
            <a
              href={settlement.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mt-2"
            >
              <Paperclip className="size-3" />
              View proof
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoryTab({ settlements }: HistoryTabProps) {
  const [filter, setFilter] = useState<"all" | "confirmed" | "disputed">("all");

  const filtered = filter === "all"
    ? settlements
    : settlements.filter((s) => s.status === filter);

  if (settlements.length === 0) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-10 text-center">
        <div className="size-14 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
          <History className="size-7 text-slate-600" />
        </div>
        <h3 className="text-base font-medium text-slate-200 mb-1">No history yet</h3>
        <p className="text-sm text-slate-500">
          Confirmed and disputed settlements will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2">
        {(["all", "confirmed", "disputed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-[#1E293B] text-slate-100 border border-[#334155]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f === "all" ? `All (${settlements.length})` : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">
          No {filter} settlements
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <HistoryCard key={s._id} settlement={s as any} />
          ))}
        </div>
      )}
    </div>
  );
}
