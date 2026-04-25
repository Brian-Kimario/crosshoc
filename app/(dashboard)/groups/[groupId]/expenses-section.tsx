"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Plus, Paperclip, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { CldUploadWidget, CloudinaryUploadWidgetResults } from "next-cloudinary";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExpenseCard, ExpenseCardItem } from "@/components/ExpenseCard";
import { SettlementCard } from "@/components/SettlementCard";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";
import { ExpenseFeedSkeleton } from "@/components/skeletons";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type SplitType = "equal" | "percentage" | "exact";

type Member = {
  id: string;
  name: string;
};

type SplitInput = {
  user: string;
  value: number;
};

const categories = [
  { value: "food", label: "Food" },
  { value: "rent", label: "Rent" },
  { value: "travel", label: "Travel" },
  { value: "transport", label: "Transport" },
  { value: "entertainment", label: "Entertainment" },
  { value: "grocery", label: "Grocery" },
  { value: "other", label: "Other" },
];

function toFixedNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface ExpenseFormProps {
  isMobile?: boolean;
  description: string;
  setDescription: (val: string) => void;
  amount: string;
  setAmount: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  paidBy: string;
  setPaidBy: (val: string) => void;
  splitType: SplitType;
  setSplitType: (val: SplitType) => void;
  customSplits: Array<{ user: string; value: number }>;
  setCustomSplits: (val: Array<{ user: string; value: number }>) => void;
  receiptUrl: string;
  setReceiptUrl: (val: string) => void;
  members: Array<{ id: string; name: string }>;
  categories: Array<{ value: string; label: string }>;
  splitSummary: number;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  toFixedNumber: (val: string) => number;
  editingExpenseId: string | null;
}

const ExpenseForm = memo(function ExpenseForm({
  isMobile = false,
  description,
  setDescription,
  amount,
  setAmount,
  category,
  setCategory,
  paidBy,
  setPaidBy,
  splitType,
  setSplitType,
  customSplits,
  setCustomSplits,
  receiptUrl,
  setReceiptUrl,
  members,
  categories,
  splitSummary,
  onSubmit,
  toFixedNumber,
  editingExpenseId,
}: ExpenseFormProps) {
  const Footer = isMobile ? SheetFooter : DialogFooter;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={isMobile ? "desc-mobile" : "description"}>Description</Label>
        <Input
          id={isMobile ? "desc-mobile" : "description"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dinner at SeaSalt Cafe"
          className="bg-slate-950 border-slate-700 text-base"
          autoFocus={!isMobile}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={isMobile ? "amt-mobile" : "amount"}>Amount</Label>
          <Input
            id={isMobile ? "amt-mobile" : "amount"}
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-slate-950 border-slate-700 text-base"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={isMobile ? "cat-mobile" : "category"}>Category</Label>
          <select
            id={isMobile ? "cat-mobile" : "category"}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-base text-white"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={isMobile ? "payer-mobile" : "paidBy"}>Paid by</Label>
        <select
          id={isMobile ? "payer-mobile" : "paidBy"}
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="w-full h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-base text-white"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Split type</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["equal", "percentage", "exact"] as SplitType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSplitType(type)}
              className={`rounded-xl sm:rounded-2xl border px-2 sm:px-3 py-2.5 sm:py-2 text-xs sm:text-sm min-h-11 transition-colors ${
                splitType === type
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-slate-700 bg-slate-950 text-slate-300"
              }`}
            >
              {type === "equal" ? "Equal" : type === "percentage" ? "Percent" : "Exact"}
            </button>
          ))}
        </div>
      </div>

      {splitType !== "equal" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 font-medium">Custom shares</p>
          {members.map((member, index) => (
            <div key={member.id} className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_120px] gap-3 items-center">
              <p className="text-sm text-slate-300">{member.name}</p>
              <Input
                type="number"
                step="0.01"
                value={customSplits[index]?.value ?? 0}
                onChange={(e) => {
                  const next = [...customSplits];
                  next[index] = {
                    user: member.id,
                    value: toFixedNumber(e.target.value),
                  };
                  setCustomSplits(next);
                }}
                className="bg-slate-950 border-slate-700 text-base h-11"
              />
            </div>
          ))}
          <p className="text-xs text-slate-400">
            Current total: {splitSummary.toFixed(2)}
            {splitType === "percentage" ? "%" : ""}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Receipt (optional)</Label>
        {receiptUrl ? (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
            <Paperclip className="size-4 text-emerald-300" />
            <span className="text-sm text-emerald-200 flex-1 truncate">Receipt attached</span>
            <button
              type="button"
              onClick={() => setReceiptUrl("")}
              className="text-slate-400 hover:text-red-300 min-h-11 min-w-11 flex items-center justify-center"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? (
          <CldUploadWidget
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "spliteasy_receipts"}
            onSuccess={(result: CloudinaryUploadWidgetResults) => {
              const info = result.info as { secure_url?: string };
              if (info?.secure_url) {
                setReceiptUrl(info.secure_url);
                toast.success("Receipt uploaded!");
              }
            }}
            onError={() => toast.error("Failed to upload receipt")}
          >
            {({ open }) => (
              <button
                type="button"
                onClick={() => open()}
                className="w-full rounded-xl border border-dashed border-slate-600 bg-slate-900/50 px-4 py-3 text-sm text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2"
              >
                <Paperclip className="size-4" />
                Attach receipt
              </button>
            )}
          </CldUploadWidget>
        ) : null}
      </div>

      <Footer className="gap-2 sm:gap-3 pt-2">
        <SheetClose>
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 min-h-11"
          >
            Cancel
          </Button>
        </SheetClose>
        <Button
          type="submit"
          className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white min-h-11"
        >
          {editingExpenseId ? "Save Changes" : "Add Expense"}
        </Button>
      </Footer>
    </form>
  );
});

export function ExpensesSection({
  groupId,
  members,
  currency = "USD",
  onOpenChange,
}: {
  groupId: string;
  members: Member[];
  currency?: SupportedCurrency | string;
  onOpenChange?: (open: boolean) => void;
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
  const [saving, setSaving] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showSettlements, setShowSettlements] = useState(true);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [paidBy, setPaidBy] = useState(members[0]?.id || "");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customSplits, setCustomSplits] = useState<SplitInput[]>(
    members.map((member) => ({ user: member.id, value: 0 }))
  );
  const [receiptUrl, setReceiptUrl] = useState<string>("");

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

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const response = await fetch(`/api/expenses?groupId=${groupId}`, {
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error || "Failed to fetch expenses");
          return;
        }
        setExpenses(data.data.expenses || []);
      } catch {
        toast.error("Failed to fetch expenses");
      }
    };

    const fetchSettlements = async () => {
      try {
        const response = await fetch(`/api/groups/${groupId}/settle`, {
          credentials: "include",
        });
        const data = await response.json();
        if (!response.ok) {
          // Don't show error for settlements, they're optional
          console.warn("Failed to fetch settlements:", data.error);
          return;
        }
        setSettlements(data.settlements || []);
      } catch {
        console.warn("Failed to fetch settlements");
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
    fetchSettlements();
  }, [groupId]);

  useEffect(() => {
    setPaidBy((prev) => prev || members[0]?.id || "");
    setCustomSplits(members.map((member) => ({ user: member.id, value: 0 })));
  }, [members]);

  const splitSummary = useMemo(() => {
    const total = customSplits.reduce((sum, split) => sum + Number(split.value || 0), 0);
    return total;
  }, [customSplits]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setCategory("other");
    setPaidBy(members[0]?.id || "");
    setSplitType("equal");
    setCustomSplits(members.map((member) => ({ user: member.id, value: 0 })));
    setReceiptUrl("");
  };

  const openEditDialog = (expense: ExpenseCardItem) => {
    setEditingExpenseId(expense._id);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCategory(expense.category || "other");
    setPaidBy(expense.paidBy._id);
    const splitType = expense.splitType || "equal";
    setSplitType(splitType);
    if (splitType === "equal") {
      setCustomSplits(members.map((member) => ({ user: member.id, value: 0 })));
    } else if (splitType === "percentage") {
      setCustomSplits(
        members.map((member) => {
          const split = expense.splits.find((item) => item.user._id === member.id);
          const percent = split ? (split.amount / Math.max(expense.amount, 0.01)) * 100 : 0;
          return { user: member.id, value: Number(percent.toFixed(2)) };
        })
      );
    } else {
      setCustomSplits(
        members.map((member) => {
          const split = expense.splits.find((item) => item.user._id === member.id);
          return { user: member.id, value: split?.amount || 0 };
        })
      );
    }
    setReceiptUrl((expense as any).receiptUrl || "");
    setOpen(true);
  };

  // Expose openAddDialog for parent component (dashboard-shell)
  const openAddDialog = () => {
    setEditingExpenseId(null);
    resetForm();
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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const amountValue = toFixedNumber(amount);
    if (!description.trim() || amountValue <= 0 || !paidBy) {
      toast.error("Please fill in description, amount, and paid by.");
      return;
    }

    const optimisticId = `temp-${Date.now()}`;
    const optimisticExpense: ExpenseCardItem = {
      _id: editingExpenseId || optimisticId,
      description,
      amount: amountValue,
      category,
      splitType,
      createdAt: new Date().toISOString(),
      paidBy: {
        _id: paidBy,
        name: members.find((member) => member.id === paidBy)?.name || "You",
      },
      createdBy: {
        _id: currentUserId,
      },
      splits:
        splitType === "equal"
          ? members.map((member) => ({
              user: { _id: member.id, name: member.name },
              amount: amountValue / Math.max(1, members.length),
            }))
          : customSplits.map((split) => ({
              user: {
                _id: split.user,
                name: members.find((member) => member.id === split.user)?.name || "Member",
              },
              amount:
                splitType === "percentage"
                  ? (amountValue * split.value) / 100
                  : split.value,
            })),
    };

    const previousExpenses = expenses;
    setSaving(true);
    if (editingExpenseId) {
      setExpenses((prev) => prev.map((expense) => (expense._id === editingExpenseId ? optimisticExpense : expense)));
    } else {
      setExpenses((prev) => [optimisticExpense, ...prev]);
    }
    setOpen(false);

    try {
      const response = await fetch(editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses", {
        method: editingExpenseId ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          description,
          amount: amountValue,
          category,
          paidBy,
          splitType,
          customSplits: splitType === "equal" ? [] : customSplits,
          receiptUrl: receiptUrl || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (editingExpenseId) {
          setExpenses(previousExpenses);
        } else {
          setExpenses((prev) => prev.filter((expense) => expense._id !== optimisticId));
        }
        toast.error(data.error || "Math doesn't add up!");
        return;
      }

      if (editingExpenseId) {
        setExpenses((prev) => prev.map((expense) => (expense._id === editingExpenseId ? data.data.expense : expense)));
      } else {
        setExpenses((prev) => [
          data.data.expense,
          ...prev.filter((expense) => expense._id !== optimisticId),
        ]);
      }
      toast.success(editingExpenseId ? "Expense updated!" : "Expense added!");
      resetForm();
      setEditingExpenseId(null);
    } catch {
      if (editingExpenseId) {
        setExpenses(previousExpenses);
        toast.error("Failed to update expense.");
      } else {
        setExpenses((prev) => prev.filter((expense) => expense._id !== optimisticId));
        toast.error("Failed to add expense.");
      }
    } finally {
      setSaving(false);
    }
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
    // Sort by date descending
    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, settlements, showSettlements]);

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
        {/* Desktop: Dialog | Mobile: Trigger button (form opens in Sheet) */}
        <div className="hidden lg:block">
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                setEditingExpenseId(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger
              render={<Button className="rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white min-h-11 px-4" />}
            >
              <Plus className="size-4 mr-2" />
              Add Expense
            </DialogTrigger>
            <DialogContent className="rounded-3xl bg-slate-900 border border-slate-700 text-white max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingExpenseId ? "Edit Expense" : "Add Expense"}
                </DialogTitle>
                <DialogDescription>
                  {editingExpenseId
                    ? "Update the expense details below."
                    : "Enter the expense details below."}
                </DialogDescription>
              </DialogHeader>
              <ExpenseForm
                description={description}
                setDescription={setDescription}
                amount={amount}
                setAmount={setAmount}
                category={category}
                setCategory={setCategory}
                paidBy={paidBy}
                setPaidBy={setPaidBy}
                splitType={splitType}
                setSplitType={setSplitType}
                customSplits={customSplits}
                setCustomSplits={setCustomSplits}
                receiptUrl={receiptUrl}
                setReceiptUrl={setReceiptUrl}
                members={members}
                categories={categories}
                splitSummary={splitSummary}
                onSubmit={onSubmit}
                toFixedNumber={toFixedNumber}
                editingExpenseId={editingExpenseId}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile: Sheet (full-screen drawer) */}
        <Sheet
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setEditingExpenseId(null);
              resetForm();
            }
          }}
        >
          <SheetContent side="bottom" className="h-dvh sm:h-[90vh] bg-slate-900 border-slate-700 text-white flex flex-col p-0">
            <SheetHeader className="px-4 py-4 border-b border-slate-700 shrink-0">
              <SheetTitle className="text-lg">{editingExpenseId ? "Edit expense" : "Add expense"}</SheetTitle>
              <SheetDescription className="text-slate-300">
                Add a receipt-style expense and choose how to split it.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ExpenseForm
                isMobile
                description={description}
                setDescription={setDescription}
                amount={amount}
                setAmount={setAmount}
                category={category}
                setCategory={setCategory}
                paidBy={paidBy}
                setPaidBy={setPaidBy}
                splitType={splitType}
                setSplitType={setSplitType}
                customSplits={customSplits}
                setCustomSplits={setCustomSplits}
                receiptUrl={receiptUrl}
                setReceiptUrl={setReceiptUrl}
                members={members}
                categories={categories}
                splitSummary={splitSummary}
                onSubmit={onSubmit}
                toFixedNumber={toFixedNumber}
                editingExpenseId={editingExpenseId}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <ExpenseFeedSkeleton />
      ) : combinedItems.length === 0 ? (
        <div className="rounded-3xl border border-slate-700 bg-slate-800/70 p-10 text-center space-y-3">
          <p className="text-5xl">💸</p>
          <p className="text-white font-semibold text-lg">No expenses yet</p>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Add your first expense using the button above and start splitting with your group.
          </p>
        </div>
      ) : (
        <ErrorBoundary>
          <div className="space-y-3">
            {combinedItems.map((item) =>
              item.type === "expense" ? (
                <ExpenseCard
                  key={`expense-${item.data._id}`}
                  expense={item.data}
                  currency={currency}
                  canEdit={item.data.createdBy?._id === currentUserId}
                  onEdit={openEditDialog}
                  onDelete={deleteExpense}
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
