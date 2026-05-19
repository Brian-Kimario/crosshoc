"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Loader2, Pencil, Trash2, PiggyBank, X, Check } from "lucide-react";
import { formatMoney } from "@/lib/money-utils";
import { keys } from "@/lib/swr-keys";

interface BudgetCardProps {
  budgetUtilization: {
    limitCents: number;
    spentCents: number;
    usedPercent: number;
    remainingCents: number;
    isOverBudget: boolean;
  } | null;
  groupId: string;
  currency: string;
  period: string; // current analytics period for SWR revalidation
}

type BudgetPeriod = "monthly" | "per-trip" | "total";

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly: "Monthly",
  "per-trip": "Per Trip",
  total: "Total",
};

interface FormState {
  limitAmount: string; // dollar amount as string (user input)
  period: BudgetPeriod;
}

interface FieldErrors {
  limitAmount?: string;
  period?: string;
  general?: string;
}

function getProgressBarColor(usedPercent: number): string {
  if (usedPercent >= 100) return "bg-rose-500";
  if (usedPercent >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function BudgetCard({
  budgetUtilization,
  groupId,
  currency,
  period,
}: BudgetCardProps) {
  const { mutate } = useSWRConfig();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    limitAmount: budgetUtilization
      ? String(budgetUtilization.limitCents / 100)
      : "",
    period: "monthly",
  });

  function openSetForm() {
    setForm({ limitAmount: "", period: "monthly" });
    setFieldErrors({});
    setNetworkError(null);
    setIsFormOpen(true);
    setIsEditing(false);
  }

  function openEditForm() {
    if (!budgetUtilization) return;
    setForm({
      limitAmount: String(budgetUtilization.limitCents / 100),
      period: "monthly",
    });
    setFieldErrors({});
    setNetworkError(null);
    setIsEditing(true);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setIsEditing(false);
    setFieldErrors({});
    setNetworkError(null);
  }

  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};
    const parsed = parseFloat(form.limitAmount);

    if (!form.limitAmount.trim()) {
      errors.limitAmount = "Limit amount is required.";
    } else if (isNaN(parsed) || parsed <= 0) {
      errors.limitAmount = "Limit must be a positive number.";
    } else if (!Number.isFinite(parsed)) {
      errors.limitAmount = "Limit must be a valid number.";
    }

    if (!["monthly", "per-trip", "total"].includes(form.period)) {
      errors.period = "Please select a valid period.";
    }

    return errors;
  }

  async function handleSave() {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setNetworkError(null);
    setIsSubmitting(true);

    const limitCents = Math.round(parseFloat(form.limitAmount) * 100);

    try {
      const res = await fetch(keys.groupBudget(groupId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limitCents,
          period: form.period,
          alertAt: 80,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (res.status === 422 && data.errors) {
          // Field-level validation errors from the server
          const serverErrors: FieldErrors = {};
          const flat = data.errors?.fieldErrors ?? {};
          if (flat.limitCents) {
            serverErrors.limitAmount = Array.isArray(flat.limitCents)
              ? flat.limitCents[0]
              : flat.limitCents;
          }
          if (flat.period) {
            serverErrors.period = Array.isArray(flat.period)
              ? flat.period[0]
              : flat.period;
          }
          if (flat._errors || data.errors?.formErrors?.length) {
            serverErrors.general =
              data.errors?.formErrors?.[0] ?? "Validation failed.";
          }
          setFieldErrors(serverErrors);
        } else {
          setNetworkError(data.error ?? "Failed to save budget. Please try again.");
        }
        return;
      }

      // Success — revalidate analytics data
      await mutate(keys.groupAnalytics(groupId, period));
      closeForm();
    } catch {
      setNetworkError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setNetworkError(null);
    setIsDeleting(true);

    try {
      const res = await fetch(keys.groupBudget(groupId), {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNetworkError(data.error ?? "Failed to delete budget. Please try again.");
        return;
      }

      // Success — revalidate analytics data
      await mutate(keys.groupAnalytics(groupId, period));
    } catch {
      setNetworkError("Network error. Please check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  // ── No budget set ──────────────────────────────────────────────────────────

  if (!budgetUtilization && !isFormOpen) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <PiggyBank className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Budget</span>
        </div>
        <button
          onClick={openSetForm}
          className="w-full border-2 border-dashed border-slate-600 hover:border-emerald-500/60 hover:bg-emerald-500/5 rounded-lg py-3 px-4 text-sm text-slate-400 hover:text-emerald-400 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <PiggyBank className="w-4 h-4" />
          Set a budget
        </button>
      </div>
    );
  }

  // ── Inline form (set or edit) ──────────────────────────────────────────────

  if (isFormOpen) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">
              {isEditing ? "Edit Budget" : "Set a Budget"}
            </span>
          </div>
          <button
            onClick={closeForm}
            disabled={isSubmitting}
            className="text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network error toast */}
        {networkError && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/50 rounded-lg text-rose-400 text-xs flex items-start gap-2">
            <div className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs leading-none">!</span>
            </div>
            <span>{networkError}</span>
          </div>
        )}

        {/* General field error */}
        {fieldErrors.general && (
          <div className="mb-3 text-xs text-rose-400">{fieldErrors.general}</div>
        )}

        <div className="space-y-3">
          {/* Limit amount input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Limit ({currency})
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.limitAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, limitAmount: e.target.value }))
              }
              placeholder="e.g. 500"
              disabled={isSubmitting}
              className={`w-full bg-slate-900/60 border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                fieldErrors.limitAmount
                  ? "border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
              }`}
            />
            {fieldErrors.limitAmount && (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.limitAmount}</p>
            )}
          </div>

          {/* Period selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Period
            </label>
            <div className="flex gap-2">
              {(["monthly", "per-trip", "total"] as BudgetPeriod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, period: p }))}
                  disabled={isSubmitting}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                    form.period === p
                      ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                      : "bg-slate-900/60 border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {fieldErrors.period && (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.period}</p>
            )}
          </div>

          {/* Save / Cancel actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="flex-1 py-2 px-3 bg-slate-700/60 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Budget set — display view ──────────────────────────────────────────────

  const { limitCents, spentCents, usedPercent, remainingCents, isOverBudget } =
    budgetUtilization!;

  const clampedPercent = Math.min(usedPercent, 100);
  const progressColor = getProgressBarColor(usedPercent);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Budget</span>
          {isOverBudget && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium">
              Over budget
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openEditForm}
            disabled={isDeleting}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-md transition-all disabled:opacity-50"
            aria-label="Edit budget"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all disabled:opacity-50"
            aria-label="Delete budget"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Network error toast */}
      {networkError && (
        <div className="mb-3 p-3 bg-rose-950/50 border border-rose-800/50 rounded-lg text-rose-400 text-xs flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs leading-none">!</span>
          </div>
          <span>{networkError}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-500">
            {usedPercent.toFixed(0)}% used
          </span>
          <span className="text-xs text-slate-500">
            {formatMoney(limitCents, currency)} limit
          </span>
        </div>
        <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      </div>

      {/* Spent / Remaining / Limit amounts */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-0.5">Spent</p>
          <p className="text-sm font-semibold text-slate-200">
            {formatMoney(spentCents, currency)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-0.5">Remaining</p>
          <p
            className={`text-sm font-semibold ${
              isOverBudget ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {formatMoney(Math.abs(remainingCents), currency)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-0.5">Limit</p>
          <p className="text-sm font-semibold text-slate-200">
            {formatMoney(limitCents, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
