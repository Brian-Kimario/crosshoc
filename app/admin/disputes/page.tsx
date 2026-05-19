"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";

interface Dispute {
  _id: string;
  amount: number;
  status: string;
  disputeReason?: string;
  fromUser: { name: string; email: string };
  toUser: { name: string; email: string };
  group: { name: string; currency: string };
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchDisputes();
  }, []);

  async function fetchDisputes() {
    setLoading(true);
    const res = await fetch("/api/admin/disputes");
    const data = await res.json();
    setDisputes(data.disputes ?? []);
    setLoading(false);
  }

  async function resolveDispute(id: string, resolution: string, note?: string) {
    setResolving(id);
    await fetch(`/api/admin/disputes/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution, note }),
    });
    setResolving(null);
    fetchDisputes();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Disputes</h1>
          <p className="text-sm text-slate-500">
            {disputes.length} disputed settlement{disputes.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-200 mb-1">No disputes</h3>
          <p className="text-sm text-slate-500">All settlements are resolved or pending confirmation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div key={dispute._id} className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {dispute.fromUser.name} disputed payment to {dispute.toUser.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {dispute.group.name} • {formatCurrency(dispute.amount, dispute.group.currency)}
                      </p>
                    </div>
                    <span className="text-xs text-rose-400 bg-rose-500/10 px-2 py-1 rounded-full w-fit">
                      Disputed
                    </span>
                  </div>

                  {dispute.disputeReason && (
                    <div className="mt-3 p-3 bg-[#1E293B]/50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Reason:</p>
                      <p className="text-sm text-slate-300">{dispute.disputeReason}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => resolveDispute(dispute._id, "confirm")}
                      disabled={resolving === dispute._id}
                      className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      Confirm Payment
                    </button>
                    <button
                      onClick={() => resolveDispute(dispute._id, "reject")}
                      disabled={resolving === dispute._id}
                      className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      Reject (Back to Pending)
                    </button>
                    <button
                      onClick={() => resolveDispute(dispute._id, "void")}
                      disabled={resolving === dispute._id}
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                      Void Settlement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
