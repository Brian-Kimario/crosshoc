"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Receipt,
  Ban,
  Loader2,
  AlertTriangle,
  CheckCircle,
  HandCoins,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-utils";
import { toast } from "sonner";
import { GroupMembersClient } from "@/components/admin/GroupMembersClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  userId:  string;
  name:    string;
  email:   string;
  role:    string;
  balance: number;
}

interface Expense {
  _id:         string;
  description: string;
  amount:      number;
  category:    string;
  paidByName:  string | null;
  createdAt:   string;
  isVoided:    boolean;
  voidedAt:    string | null;
}

interface Settlement {
  _id:       string;
  fromUser?: { name: string };
  toUser?:   { name: string };
  amount:    number;
  method?:   string;
  status:    string;
  createdAt: string;
}

interface GroupDetail {
  _id:         string;
  name:        string;
  currency:    string;
  createdAt:   string;
  memberCount: number;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ["Expenses", "Settlements", "Members"] as const;
type Tab = typeof TABS[number];

// ── Settlement row component ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-950/50 border-amber-700/40 text-amber-400",
  confirmed: "bg-emerald-950/50 border-emerald-700/40 text-emerald-400",
  disputed:  "bg-rose-950/50 border-rose-700/40 text-rose-400",
  voided:    "bg-[#1E293B] border-[#334155] text-slate-500",
};

function SettlementRow({
  settlement: s,
  groupId,
  currency,
  onVoided,
}: {
  settlement: Settlement;
  groupId:    string;
  currency:   string;
  onVoided:   (id: string) => void;
}) {
  const [voiding,    setVoiding]    = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason,     setReason]     = useState("");

  async function handleVoid() {
    if (!reason.trim()) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/admin/settlements/${s._id}/void`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        onVoided(s._id);
        setShowReason(false);
        setReason("");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to void settlement");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setVoiding(false);
    }
  }

  return (
    <>
      <tr className={`hover:bg-[#1E293B]/30 ${s.status === "voided" ? "opacity-50" : ""}`}>
        <td className="px-4 py-3 text-sm text-slate-300">
          {s.fromUser?.name ?? "Unknown"}
        </td>
        <td className="px-4 py-3 text-sm text-slate-300">
          {s.toUser?.name ?? "Unknown"}
        </td>
        <td className="px-4 py-3 text-sm text-slate-200 font-medium">
          {formatCurrency(s.amount, currency)}
        </td>
        <td className="px-4 py-3 text-sm text-slate-400">
          {s.method ?? "—"}
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              STATUS_COLORS[s.status] ?? "bg-[#1E293B] border-[#334155] text-slate-400"
            }`}
          >
            {s.status}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
          {new Date(s.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day:   "numeric",
            year:  "numeric",
          })}
        </td>
        <td className="px-4 py-3">
          {s.status !== "voided" && !showReason && (
            <button
              onClick={() => { setShowReason(true); setReason(""); }}
              className="text-rose-400 text-xs border border-rose-800/40 px-2.5 py-1 rounded-lg hover:bg-rose-950/30 transition-all min-h-[28px]"
            >
              Void
            </button>
          )}
        </td>
      </tr>

      {/* Reason input row */}
      {showReason && (
        <tr className="bg-[#080E1A]">
          <td colSpan={7} className="px-4 pb-4 pt-2">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for voiding (required)"
                autoFocus
                className="flex-1 bg-[#1E293B] border border-rose-800/40 rounded-xl px-3 py-2 text-slate-200 text-sm placeholder-slate-600 outline-none focus:border-rose-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVoid();
                  if (e.key === "Escape") setShowReason(false);
                }}
              />
              <button
                onClick={handleVoid}
                disabled={!reason.trim() || voiding}
                className="bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-40 transition-all min-h-[40px]"
              >
                {voiding ? "Voiding..." : "Confirm void"}
              </button>
              <button
                onClick={() => setShowReason(false)}
                className="text-slate-500 text-sm px-3 py-2 border border-[#334155] rounded-xl hover:bg-[#1E293B] transition-all"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminGroupDetailPage() {
  const params  = useParams();
  const groupId = params.groupId as string;

  const [group,          setGroup]          = useState<GroupDetail | null>(null);
  const [members,        setMembers]        = useState<Member[]>([]);
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [expenseTotal,   setExpenseTotal]   = useState(0);
  const [settlements,    setSettlements]    = useState<{ data: Settlement[]; total: number }>({ data: [], total: 0 });
  const [loading,        setLoading]        = useState(true);
  const [voidingId,      setVoidingId]      = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState<Tab>("Expenses");

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/groups/${groupId}`);
      if (!res.ok) { toast.error("Failed to load group"); return; }
      const data = await res.json();
      setGroup(data.group);
      setMembers(data.members ?? []);
      setExpenses(data.expenses?.data ?? []);
      setExpenseTotal(data.expenses?.total ?? 0);
      setSettlements({
        data:  data.settlements?.data  ?? [],
        total: data.settlements?.total ?? 0,
      });
    } catch {
      toast.error("Failed to load group");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  async function voidExpense(expenseId: string, description: string) {
    const reason = window.prompt(`Reason for voiding "${description}":`);
    if (!reason?.trim()) return;

    setVoidingId(expenseId);
    try {
      const res  = await fetch(`/api/admin/expenses/${expenseId}/void`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to void expense"); return; }
      toast.success("Expense voided");
      setExpenses((prev) =>
        prev.map((e) =>
          e._id === expenseId
            ? { ...e, isVoided: true, voidedAt: new Date().toISOString() }
            : e
        )
      );
    } catch {
      toast.error("Failed to void expense");
    } finally {
      setVoidingId(null);
    }
  }

  function handleSettlementVoided(id: string) {
    setSettlements((prev) => ({
      ...prev,
      data: prev.data.map((s) =>
        s._id === id ? { ...s, status: "voided" } : s
      ),
    }));
    toast.success("Settlement voided");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Group not found</p>
        <Link href="/admin/groups" className="text-teal-400 hover:underline text-sm mt-2 inline-block">
          ← Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href="/admin/groups"
          className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          All Groups
        </Link>
        <h1 className="text-xl font-semibold text-slate-100">{group.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {group.memberCount} members · {expenseTotal} expenses · {settlements.total} settlements ·{" "}
          {group.currency} · Created {new Date(group.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Admin capability notice */}
      <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-300 mb-1">Admin view — read-only with moderation tools</p>
            <p className="text-slate-400">
              You can view all group data, void expenses, void settlements, and remove members.
              You cannot add expenses, settle debts, or act as a group member.
            </p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-[#0F172A] border border-[#1E293B] rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? "bg-[#1E293B] text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab}
            {tab === "Members"     && <span className="ml-1.5 text-xs text-slate-600">({members.length})</span>}
            {tab === "Expenses"    && <span className="ml-1.5 text-xs text-slate-600">({expenseTotal})</span>}
            {tab === "Settlements" && <span className="ml-1.5 text-xs text-slate-600">({settlements.total})</span>}
          </button>
        ))}
      </div>

      {/* ── Expenses tab ── */}
      {activeTab === "Expenses" && (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-medium text-slate-200">Expenses ({expenseTotal})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {["Description", "Amount", "Paid By", "Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No expenses
                    </td>
                  </tr>
                ) : expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className={`hover:bg-[#1E293B]/30 ${expense.isVoided ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-200 max-w-[200px] truncate">
                      {expense.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-200">
                      {formatCurrency(expense.amount, group.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {expense.paidByName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(expense.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {expense.isVoided ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Ban className="w-3 h-3" /> Voided
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!expense.isVoided && (
                        <button
                          onClick={() => voidExpense(expense._id, expense.description)}
                          disabled={voidingId === expense._id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {voidingId === expense._id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Ban className="w-3 h-3" />
                          )}
                          Void
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

      {/* ── Settlements tab ── */}
      {activeTab === "Settlements" && (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-medium text-slate-200">
              Settlements ({settlements.total})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E293B]">
                  {["From", "To", "Amount", "Method", "Status", "Date", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {settlements.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      No settlements in this group
                    </td>
                  </tr>
                ) : settlements.data.map((s) => (
                  <SettlementRow
                    key={s._id}
                    settlement={s}
                    groupId={groupId}
                    currency={group.currency}
                    onVoided={handleSettlementVoided}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Members tab ── */}
      {activeTab === "Members" && (
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B] flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-medium text-slate-200">Members ({members.length})</h2>
          </div>
          <GroupMembersClient
            groupId={groupId}
            initialMembers={members}
            currency={group.currency}
          />
        </div>
      )}
    </div>
  );
}
