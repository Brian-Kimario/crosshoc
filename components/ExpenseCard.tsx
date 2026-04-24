"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ImageIcon, Pencil, Trash2, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";

export interface ExpenseCardSplit {
  user: {
    _id: string;
    name: string;
  };
  amount: number;
}

export interface ExpenseCardItem {
  _id: string;
  description: string;
  amount: number;
  category?: string;
  splitType?: "equal" | "percentage" | "exact";
  createdAt: string;
  paidBy: {
    _id: string;
    name: string;
  };
  createdBy?: {
    _id: string;
    name?: string;
  };
  splits: ExpenseCardSplit[];
  receiptUrl?: string;
  // Guest fields
  isGuest?: boolean;
  guestName?: string;
}

const CATEGORY_ICON: Record<string, string> = {
  food: "🍔",
  rent: "🏠",
  travel: "✈️",
  transport: "🚕",
  entertainment: "🎬",
  grocery: "🛒",
  other: "🧾",
};

export function ExpenseCard({
  expense,
  canEdit,
  onEdit,
  onDelete,
  currency = "USD",
}: {
  expense: ExpenseCardItem;
  canEdit?: boolean;
  onEdit?: (expense: ExpenseCardItem) => void;
  onDelete?: (expenseId: string) => void;
  currency?: SupportedCurrency | string;
}) {
  const [expanded, setExpanded] = useState(false);

  const icon = CATEGORY_ICON[(expense.category || "other").toLowerCase()] || "🧾";

  // For guest expenses, use guestName as the display name for paidBy
  const paidByName = expense.isGuest && expense.guestName
    ? expense.guestName
    : expense.paidBy.name;

  const oweBreakdown = useMemo(
    () =>
      expense.splits
        // For guest expenses show all splits (everyone owes the guest); for regular expenses exclude the payer
        .filter((split) => expense.isGuest || split.user._id !== expense.paidBy._id)
        .map((split) => ({ name: split.user.name, amount: split.amount })),
    [expense.splits, expense.paidBy._id, expense.isGuest]
  );

  return (
    <Card className={`rounded-2xl sm:rounded-3xl border bg-slate-800/80 overflow-hidden ${expense.isGuest ? "border-emerald-500/40" : "border-slate-700"}`}>
      <CardContent className="p-3 sm:p-5 space-y-2 sm:space-y-3">
        {/* Mobile-First Vertical Layout: Amount is KING */}
        <div className="flex flex-col gap-2">
          {/* Top row: Amount (prominent) + Category icon */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl sm:text-2xl shrink-0" aria-hidden="true">{icon}</span>
              <div className="min-w-0">
                <p className={`text-sm sm:text-base font-medium truncate ${expense.isGuest ? "text-white" : "text-slate-100"}`}>
                  {expense.description}
                </p>
                <p className="text-xs text-slate-500 sm:hidden">
                  {new Date(expense.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white shrink-0">
              {formatCurrency(expense.amount, currency)}
            </p>
          </div>

          {/* Payer info - clearly separated */}
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${expense.isGuest ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-slate-700/50 text-slate-300"}`}>
              <Receipt className="size-3" />
              <span>Paid by {expense.isGuest ? `${paidByName} (Guest)` : paidByName}</span>
            </div>
            <p className="hidden sm:block text-xs text-slate-400">
              {new Date(expense.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action buttons row - minimum 44px touch targets */}
        <div className="flex items-center justify-between pt-1 sm:pt-0">
          <div className="flex items-center gap-1">
            {expense.receiptUrl ? (
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs sm:text-sm text-emerald-300 hover:text-emerald-200 hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
                aria-label="View receipt"
              >
                <ImageIcon className="size-4" />
                <span className="hidden sm:inline">Receipt</span>
              </a>
            ) : null}
          </div>

          <div className="flex items-center gap-0.5">
            {/* Expand splits - larger touch target */}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:min-w-0 px-2 sm:px-3 rounded-xl text-xs sm:text-sm text-emerald-300 hover:text-emerald-200 hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide split details" : "Show split details"}
            >
              <span className="hidden sm:inline">Splits</span>
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {canEdit ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 active:bg-slate-700 transition-colors"
                  onClick={() => onEdit?.(expense)}
                  aria-label="Edit expense"
                >
                  <Pencil className="size-4" />
                </button>
                <Dialog>
                  <DialogTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-red-300 hover:text-red-200 hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    }
                  />
                  <DialogContent className="rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-700 text-white max-w-[calc(100%-2rem)] sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Delete expense?</DialogTitle>
                      <DialogDescription className="text-slate-300">
                        This action cannot be undone. The expense and its split history will be removed.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <DialogClose
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-700 bg-transparent hover:bg-slate-800 min-h-[44px] flex-1 sm:flex-none"
                          />
                        }
                      >
                        Cancel
                      </DialogClose>
                      <DialogClose
                        render={
                          <Button
                            type="button"
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl sm:rounded-3xl min-h-[44px] flex-1 sm:flex-none"
                          />
                        }
                        onClick={() => onDelete?.(expense._id)}
                      >
                        Delete
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            ) : null}
          </div>
        </div>

        {/* Expandable split details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="rounded-xl sm:rounded-2xl bg-slate-900/70 border border-slate-700 p-3 space-y-2 mt-2">
                {oweBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-300">No shared splits on this expense.</p>
                ) : (
                  oweBreakdown.map((item, index) => (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="text-slate-300">{item.name}</span>
                      <span className="text-emerald-400 font-medium">{formatCurrency(item.amount, currency)}</span>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
