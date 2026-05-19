"use client";

import { useState } from "react";
import { Trash2, Loader2, Shield } from "lucide-react";
import { formatCurrency } from "@/lib/format-utils";

interface Member {
  userId:  string;
  name:    string;
  email:   string;
  role:    string;
  balance: number;
}

interface GroupMembersClientProps {
  groupId:        string;
  initialMembers: Member[];
  currency:       string;
}

export function GroupMembersClient({
  groupId,
  initialMembers,
  currency,
}: GroupMembersClientProps) {
  const [members,    setMembers]    = useState<Member[]>(initialMembers);
  const [removing,   setRemoving]   = useState<string | null>(null);
  const [showReason, setShowReason] = useState<string | null>(null);
  const [reason,     setReason]     = useState("");

  async function handleRemove(userId: string, userName: string) {
    if (!reason.trim()) return;
    setRemoving(userId);
    try {
      const res = await fetch(
        `/api/admin/groups/${groupId}/members/${userId}`,
        {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ reason: reason.trim() }),
        }
      );
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        setShowReason(null);
        setReason("");
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to remove member");
      }
    } catch {
      alert("Network error — please try again");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="divide-y divide-[#1E293B]">
      {members.map((member) => (
        <div key={member.userId}>
          {/* Member row */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-200">{member.name}</p>
                {member.role === "owner" && (
                  <Shield className="w-3.5 h-3.5 text-amber-400" aria-label="Owner" />
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    member.role === "owner"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : member.role === "admin"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                      : "bg-slate-700/50 text-slate-500 border-slate-600/30"
                  }`}
                >
                  {member.role}
                </span>
              </div>
              <p className="text-xs text-slate-500">{member.email}</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Balance */}
              <span
                className={`text-sm font-medium ${
                  member.balance > 0
                    ? "text-emerald-400"
                    : member.balance < 0
                    ? "text-rose-400"
                    : "text-slate-500"
                }`}
              >
                {member.balance === 0
                  ? "Settled"
                  : member.balance > 0
                  ? `+${formatCurrency(member.balance, currency)}`
                  : formatCurrency(member.balance, currency)}
              </span>

              {/* Remove button — not for owners */}
              {member.role !== "owner" && (
                <button
                  onClick={() => {
                    setShowReason(member.userId);
                    setReason("");
                  }}
                  disabled={removing === member.userId}
                  className="p-2 rounded-lg hover:bg-rose-950/30 text-slate-600 hover:text-rose-400 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center flex-shrink-0"
                  aria-label={`Remove ${member.name}`}
                >
                  {removing === member.userId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Reason input — expands below the row */}
          {showReason === member.userId && (
            <div className="px-4 pb-4 bg-[#080E1A] border-t border-[#1E293B]">
              <p className="text-xs text-slate-500 mt-3 mb-2">
                Reason for removing{" "}
                <span className="text-slate-300 font-medium">{member.name}</span>{" "}
                (required — will be emailed to them):
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Duplicate account, requested removal..."
                  autoFocus
                  className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-rose-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRemove(member.userId, member.name);
                    if (e.key === "Escape") { setShowReason(null); setReason(""); }
                  }}
                />
                <button
                  onClick={() => handleRemove(member.userId, member.name)}
                  disabled={!reason.trim() || removing === member.userId}
                  className="bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-40 transition-all min-h-[40px]"
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setShowReason(null); setReason(""); }}
                  className="text-slate-500 text-sm px-3 py-2 border border-[#334155] rounded-xl hover:bg-[#1E293B] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
