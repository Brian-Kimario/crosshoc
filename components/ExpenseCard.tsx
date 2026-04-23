"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Image, Pencil, Trash2 } from "lucide-react";
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

function currency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function ExpenseCard({
  expense,
  canEdit,
  onEdit,
  onDelete,
}: {
  expense: ExpenseCardItem;
  canEdit?: boolean;
  onEdit?: (expense: ExpenseCardItem) => void;
  onDelete?: (expenseId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const icon = CATEGORY_ICON[(expense.category || "other").toLowerCase()] || "🧾";
  const oweBreakdown = useMemo(
    () =>
      expense.splits
        .filter((split) => split.user._id !== expense.paidBy._id)
        .map((split) => ({
          name: split.user.name,
          amount: split.amount,
        })),
    [expense.splits, expense.paidBy._id]
  );

  return (
    <Card className="rounded-3xl border-slate-700 bg-slate-800/80">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">{icon} {expense.description}</p>
            <p className="text-xs text-slate-400 mt-1">
              Paid by {expense.paidBy.name}
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{currency(expense.amount)}</p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {new Date(expense.createdAt).toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            {expense.receiptUrl ? (
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-sm text-emerald-300 hover:text-emerald-200 hover:bg-slate-700"
              >
                <Image className="size-4" />
                View Receipt
              </a>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="text-emerald-300 hover:text-emerald-200 hover:bg-slate-700 rounded-2xl"
              onClick={() => setExpanded((prev) => !prev)}
            >
              Who owes what
              {expanded ? <ChevronUp className="size-4 ml-1" /> : <ChevronDown className="size-4 ml-1" />}
            </Button>
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:bg-slate-700 rounded-2xl"
                  onClick={() => onEdit?.(expense)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-300 hover:bg-slate-700 rounded-2xl"
                      />
                    }
                  >
                    <Trash2 className="size-4" />
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl bg-slate-900 border border-slate-700 text-white">
                    <DialogHeader>
                      <DialogTitle>Delete expense?</DialogTitle>
                      <DialogDescription className="text-slate-300">
                        This action cannot be undone. The expense and its split history will be removed.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-700 bg-transparent hover:bg-slate-800"
                          />
                        }
                      >
                        Cancel
                      </DialogClose>
                      <DialogClose
                        render={
                          <Button
                            type="button"
                            className="bg-red-500 hover:bg-red-600 text-white rounded-3xl"
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

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-slate-900/70 border border-slate-700 p-3 space-y-2 mt-3">
                {oweBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-300">No shared splits on this expense.</p>
                ) : (
                  oweBreakdown.map((item, index) => (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-300">{item.name}</span>
                      <span className="text-emerald-300">{currency(item.amount)}</span>
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
