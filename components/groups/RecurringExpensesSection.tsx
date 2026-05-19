"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { RefreshCw, Plus, Square, AlertCircle } from "lucide-react";
import { keys } from "@/lib/swr-keys";
import { formatMoney } from "@/lib/money-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Frequency = "daily" | "weekly" | "biweekly" | "monthly";

interface RecurringExpense {
  _id: string;
  description: string;
  amount: number; // integer cents
  category: string;
  frequency: Frequency;
  nextDueAt: string; // ISO date string
  isActive: boolean;
}

interface RecurringApiResponse {
  recurringExpenses: RecurringExpense[];
}

interface RecurringExpensesSectionProps {
  groupId: string;
  canManage: boolean;
  currency: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

function formatDueDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(isoDate: string): boolean {
  return new Date(isoDate) < new Date();
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#1E293B] bg-[#1E293B]/30 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-[#1E293B] shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-3.5 bg-[#1E293B] rounded w-2/3" />
        <div className="h-3 bg-[#1E293B] rounded w-1/3" />
      </div>
      <div className="h-3 bg-[#1E293B] rounded w-16 shrink-0" />
    </div>
  );
}

// ─── Add Form ─────────────────────────────────────────────────────────────────

interface AddFormProps {
  groupId: string;
  currency: string;
  onClose: () => void;
}

function AddRecurringForm({ groupId, currency, onClose }: AddFormProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    // Convert display amount to cents
    const amountCents = Math.round(amountNum * 100);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: amountCents,
          category: category.trim() || "General",
          frequency,
          startDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create recurring expense.");
        return;
      }

      await mutate(keys.groupRecurring(groupId));
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-4 rounded-xl border border-[#1E293B] bg-[#0B1120] space-y-3"
    >
      <h4 className="text-sm font-semibold text-slate-200">New Recurring Expense</h4>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs text-slate-400 mb-1" htmlFor="re-description">
          Description
        </label>
        <input
          id="re-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Monthly rent"
          className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          required
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs text-slate-400 mb-1" htmlFor="re-amount">
          Amount ({currency})
        </label>
        <input
          id="re-amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          required
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs text-slate-400 mb-1" htmlFor="re-category">
          Category
        </label>
        <input
          id="re-category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Rent, Utilities"
          className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs text-slate-400 mb-1" htmlFor="re-frequency">
          Frequency
        </label>
        <select
          id="re-frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Frequency)}
          className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-xs text-slate-400 mb-1" htmlFor="re-startdate">
          Start Date
        </label>
        <input
          id="re-startdate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg border border-[#1E293B] bg-[#0F172A] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
          required
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 min-h-[44px] rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 min-h-[44px] rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-[#1E293B] text-sm font-medium text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RecurringExpensesSection({
  groupId,
  canManage,
  currency,
}: RecurringExpensesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const { data, isLoading } = useSWR<RecurringApiResponse>(
    keys.groupRecurring(groupId),
    fetcher
  );

  const recurringExpenses = data?.recurringExpenses ?? [];

  async function handleStop(id: string) {
    setStoppingId(id);
    try {
      await fetch(`/api/groups/${groupId}/recurring/${id}`, {
        method: "DELETE",
      });
      await mutate(keys.groupRecurring(groupId));
    } finally {
      setStoppingId(null);
    }
  }

  return (
    <section
      className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5"
      aria-label="Recurring expenses"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-teal-400 shrink-0" />
          <h3 className="font-semibold text-slate-100">Recurring Expenses</h3>
        </div>

        {canManage && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-400 text-sm font-medium transition-colors"
            aria-label="Add recurring expense"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
      </div>

      {/* Inline Add Form */}
      {canManage && showAddForm && (
        <AddRecurringForm
          groupId={groupId}
          currency={currency}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && recurringExpenses.length === 0 && (
        <div className="text-center py-6">
          <RefreshCw className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No recurring expenses yet</p>
          {canManage && (
            <p className="text-xs text-slate-600 mt-1">
              Tap &ldquo;Add&rdquo; to set up automated charges
            </p>
          )}
        </div>
      )}

      {/* Expense List */}
      {!isLoading && recurringExpenses.length > 0 && (
        <ul className="space-y-2" role="list">
          {recurringExpenses.map((item) => {
            const overdue = isOverdue(item.nextDueAt);
            const isStopping = stoppingId === item._id;

            return (
              <li
                key={item._id}
                className="flex items-start gap-3 p-3 rounded-xl border border-[#1E293B] bg-[#1E293B]/30"
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-teal-900/40 flex items-center justify-center shrink-0 mt-0.5">
                  <RefreshCw className="w-4 h-4 text-teal-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {item.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    {/* Amount */}
                    <span className="text-xs text-slate-400">
                      {formatMoney(item.amount, currency)}
                    </span>

                    {/* Frequency badge */}
                    <span className="text-xs text-slate-500">
                      · {FREQUENCY_LABELS[item.frequency] ?? item.frequency}
                    </span>

                    {/* Next due date */}
                    <span className="text-xs text-slate-500">
                      · Due {formatDueDate(item.nextDueAt)}
                    </span>

                    {/* Overdue badge */}
                    {overdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-900/40 border border-rose-700/50 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Stop button */}
                {canManage && (
                  <button
                    onClick={() => handleStop(item._id)}
                    disabled={isStopping}
                    className="shrink-0 flex items-center gap-1 min-h-[44px] min-w-[44px] px-2 rounded-lg border border-[#1E293B] bg-[#0F172A] hover:bg-rose-900/20 hover:border-rose-700/50 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors disabled:opacity-50"
                    aria-label={`Stop ${item.description}`}
                    title="Stop this recurring expense"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
