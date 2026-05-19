"use client";

import { useState, useEffect } from "react";
import { Link2, Clock, CheckCircle, XCircle, Trash2, Loader2 } from "lucide-react";

interface InviteToken {
  _id: string;
  groupId: string;
  groupName: string;
  token: string;
  expiresAt: string | null;
  isExpired: boolean;
  createdBy: { name: string; email: string } | null;
  createdAt: string;
}

type Filter = "active" | "expired" | "all";

function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminInvitesPage() {
  const [tokens, setTokens]   = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("active");
  const [revoking, setRevoking] = useState<string | null>(null);

  async function fetchTokens(f: Filter) {
    setLoading(true);
    const res  = await fetch(`/api/admin/invites?filter=${f}`);
    const data = await res.json();
    setTokens(data.tokens ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTokens(filter); }, [filter]);

  async function revokeToken(groupId: string) {
    if (!window.confirm("Revoke this invite link? The group creator will need to generate a new one.")) return;
    setRevoking(groupId);
    await fetch("/api/admin/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    setRevoking(null);
    fetchTokens(filter);
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "active",  label: "Active" },
    { id: "expired", label: "Expired" },
    { id: "all",     label: "All" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Invite Tokens</h1>
        <p className="text-sm text-slate-500">
          {tokens.length} token{tokens.length !== 1 ? "s" : ""} shown
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.id
                ? "bg-[#1E293B] text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
        </div>
      ) : tokens.length === 0 ? (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-8 text-center">
          <Link2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No {filter} invite tokens</p>
        </div>
      ) : (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {["Group", "Created By", "Expires", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {tokens.map((t) => (
                  <tr key={t._id} className="hover:bg-[#1E293B]/30">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-200">{t.groupName}</p>
                      <p className="text-xs text-slate-600 font-mono truncate max-w-[160px]">
                        {t.token?.slice(0, 16)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {t.createdBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3.5 h-3.5 ${t.isExpired ? "text-rose-400" : "text-amber-400"}`} />
                        <span className={`text-xs ${t.isExpired ? "text-rose-400" : "text-amber-300"}`}>
                          {timeRemaining(t.expiresAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {t.isExpired ? (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3" /> Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!t.isExpired && (
                        <button
                          onClick={() => revokeToken(t.groupId)}
                          disabled={revoking === t.groupId}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                          title="Revoke invite token"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
