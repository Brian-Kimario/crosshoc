"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AddExpenseWizard } from "@/components/dashboard/AddExpenseWizard";
import { ExpenseCard, ExpenseCardItem } from "@/components/ExpenseCard";
import { SettlementCard } from "@/components/SettlementCard";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";
import { ExpenseFeedSkeleton } from "@/components/skeletons";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type Member = {
  id: string;
  name: string;
};

export function ExpensesSection({
  groupId,
  members,
  currency = "USD",
  onOpenChange,
  currentUserRole,
}: {
  groupId: string;
  members: Member[];
  currency?: SupportedCurrency | string;
  onOpenChange?: (open: boolean) => void;
  currentUserRole?: "owner" | "admin" | "member";
}) {
  const [expenses, setExpenses] = useState<ExpenseCardItem[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [open, setOpen] = useState(false);

  // Wire up external open change handler (for dashboard-shell integration)
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const [showSettlements, setShowSettlements] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        setCurrentUserId(data.data.user.id);
      } catch {
        // no-op
      }
    };
    fetchMe();
  }, []);

  const refreshExpenses = useCallback(async () => {
    try {
      const response = await fetch(`/api/expenses?groupId=${groupId}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setExpenses(data.data.expenses || []);
      }
    } catch {
      // no-op
    }
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [expensesRes, settlementsRes] = await Promise.allSettled([
          fetch(`/api/expenses?groupId=${groupId}`, { credentials: "include" }),
          fetch(`/api/groups/${groupId}/settle`, { credentials: "include" }),
        ]);

        if (cancelled) return;

        if (expensesRes.status === "fulfilled") {
          const data = await expensesRes.value.json();
          if (expensesRes.value.ok) {
            setExpenses(data.data.expenses || []);
          } else {
            toast.error(data.error || "Failed to fetch expenses");
          }
        }

        if (settlementsRes.status === "fulfilled") {
          const data = await settlementsRes.value.json();
          if (settlementsRes.value.ok) {
            setSettlements(data.settlements || []);
          }
        }
      } catch {
        if (!cancelled) toast.error("Failed to fetch expenses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [groupId]);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    refreshExpenses();
  }, [refreshExpenses]);

  // Expose openAddDialog for parent component (dashboard-shell)
  const openAddDialog = () => {
    setOpen(true);
  };

  // Attach to window for external access (dashboard-shell mobile button)
  if (typeof window !== "undefined") {
    (window as any).__spliteasy_openExpenseDialog = openAddDialog;
  }

  const deleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    const res = await fetch(`/api/expenses/${expenseId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      toast.error(errorData.error || "Failed to delete expense");
      return;
    }

    setExpenses((prev) => prev.filter((e) => String(e._id) !== expenseId));
    toast.success("Expense deleted");
  };

  const voidExpense = async (expenseId: string) => {
    const reason = window.prompt("Reason for voiding this expense:");
    if (!reason?.trim()) return;

    const res = await fetch(`/api/expenses/${expenseId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason: reason.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Failed to void expense");
      return;
    }

    toast.success("Expense voided");
    refreshExpenses();
  };

  // Combine expenses and settlements for display
  const combinedItems = useMemo(() => {
    const allItems: Array<
      | { type: "expense"; data: ExpenseCardItem; date: string }
      | { type: "settlement"; data: any; date: string }
    > = [
      ...expenses.map((e) => ({ type: "expense" as const, data: e, date: e.createdAt })),
      ...(showSettlements
        ? settlements.map((s) => ({ type: "settlement" as const, data: s, date: s.settledAt }))
        : []),
    ];
    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, settlements, showSettlements]);

  const isManagerRole = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-white font-semibold">Expense Feed</p>
          {settlements.length > 0 && (
            <button
              onClick={() => setShowSettlements(!showSettlements)}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-300 transition-colors"
            >
              {showSettlements ? (
                <>
                  <EyeOff className="size-3" />
                  Hide {settlements.length} payment{settlements.length > 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <Eye className="size-3" />
                  Show {settlements.length} payment{settlements.length > 1 ? "s" : ""}
                </>
              )}
            </button>
          )}
        </div>

        {/* Add Expense Button */}
        <Button
          onClick={() => setOpen(true)}
          className="rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white min-h-11 px-4"
        >
          <Plus className="size-4 mr-2" />
          Add Expense
        </Button>

        {/* Add Expense Wizard - same as search bar */}
        <AddExpenseWizard
          open={open}
          onOpenChange={setOpen}
          groupId={groupId}
          members={members}
          currency={currency}
          currentUserId={currentUserId}
          onSuccess={handleSuccess}
        />
      </div>

      {loading ? (
        <ExpenseFeedSkeleton />
      ) : combinedItems.length === 0 ? (
        <div className="rounded-2xl border border-[#1E293B] bg-[#0F172A] p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto">
            <span className="text-3xl sm:text-4xl">💸</span>
          </div>
          <div>
            <p className="text-slate-100 font-semibold text-lg mb-1">No expenses yet</p>
            <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
              Add your first expense and start splitting costs with your group members.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#10B981] hover:bg-[#059669] text-white font-medium rounded-xl transition-colors tap-feedback"
          >
            <Plus className="w-5 h-5" />
            Add First Expense
          </button>
        </div>
      ) : (
        <ErrorBoundary>
          <div className="space-y-3 expense-feed">
            {combinedItems.map((item) =>
              item.type === "expense" ? (
                <ExpenseCard
                  key={`expense-${item.data._id}`}
                  expense={item.data}
                  currency={currency}
                  canEdit={
                    !item.data.isVoided && (
                      String(item.data.createdBy?._id) === currentUserId ||
                      isManagerRole
                    )
                  }
                  canVoid={
                    !item.data.isVoided && (
                      String(item.data.createdBy?._id) === currentUserId ||
                      isManagerRole
                    )
                  }
                  onEdit={() => {}}
                  onDelete={deleteExpense}
                  onVoid={voidExpense}
                />
              ) : (
                <SettlementCard
                  key={`settlement-${item.data._id}`}
                  settlement={item.data}
                  currency={currency}
                />
              )
            )}
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}
