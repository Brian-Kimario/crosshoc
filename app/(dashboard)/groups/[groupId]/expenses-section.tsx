"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Paperclip, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { CldUploadWidget, CloudinaryUploadWidgetResults } from "next-cloudinary";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExpenseCard, ExpenseCardItem } from "@/components/ExpenseCard";
import { SettlementCard } from "@/components/SettlementCard";

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

export function ExpensesSection({
  groupId,
  members,
}: {
  groupId: string;
  members: Member[];
}) {
  const [expenses, setExpenses] = useState<ExpenseCardItem[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [open, setOpen] = useState(false);
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

  const deleteExpense = async (expenseId: string) => {
    const previous = expenses;
    setExpenses((prev) => prev.filter((expense) => expense._id !== expenseId));
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setExpenses(previous);
        toast.error(data.error || "Failed to delete expense.");
        return;
      }
      toast.success("Expense deleted.");
    } catch {
      setExpenses(previous);
      toast.error("Failed to delete expense.");
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
            render={<Button className="rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white" />}
          >
            <Plus className="size-4 mr-2" />
            Add Expense
          </DialogTrigger>
          <DialogContent className="rounded-3xl bg-slate-900 border border-slate-700 text-white max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExpenseId ? "Edit expense" : "Add expense"}</DialogTitle>
              <DialogDescription className="text-slate-300">
                Add a receipt-style expense and choose how to split it.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Dinner at SeaSalt Cafe"
                  className="bg-slate-950 border-slate-700"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-slate-950 border-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm"
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
                <Label htmlFor="paidBy">Paid by</Label>
                <select
                  id="paidBy"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm"
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
                      className={`rounded-2xl border px-3 py-2 text-sm ${
                        splitType === type
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                          : "border-slate-700 bg-slate-950 text-slate-300"
                      }`}
                    >
                      {type === "equal" ? "Equal" : type === "percentage" ? "Percent" : "Exact Amount"}
                    </button>
                  ))}
                </div>
              </div>

              {splitType !== "equal" ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">Custom shares</p>
                  {members.map((member, index) => (
                    <div key={member.id} className="grid grid-cols-[1fr_120px] gap-2 items-center">
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
                        className="bg-slate-950 border-slate-700"
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
                      className="text-slate-400 hover:text-red-300"
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
                    options={{
                      sources: ["local", "camera"],
                      multiple: false,
                      maxFiles: 1,
                      resourceType: "image",
                    }}
                  >
                    {({ open }) => (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => open()}
                        className="w-full border-slate-700 bg-slate-950 hover:bg-slate-800 hover:border-emerald-500 text-slate-300"
                      >
                        <Paperclip className="size-4 mr-2" />
                        Attach Receipt
                      </Button>
                    )}
                  </CldUploadWidget>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/50 px-3 py-3 text-center">
                    <p className="text-xs text-slate-400">Receipt upload not configured</p>
                    <p className="text-xs text-slate-500 mt-1">Add Cloudinary env vars to enable</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 bg-transparent hover:bg-slate-800"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-3xl bg-emerald-500 hover:bg-emerald-600"
                >
                  {saving ? "Saving..." : editingExpenseId ? "Update Expense" : "Save Expense"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-700 bg-slate-800/70 p-5 text-slate-300">Loading...</div>
      ) : combinedItems.length === 0 ? (
        <div className="rounded-3xl border border-slate-700 bg-slate-800/70 p-8 text-center">
          <p className="text-4xl mb-2">💸</p>
          <p className="text-white font-semibold">No expenses yet 💸</p>
          <p className="text-slate-300 text-sm mt-1">Add your first expense to kick off Phase 4.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {combinedItems.map((item) =>
            item.type === "expense" ? (
              <ExpenseCard
                key={`expense-${item.data._id}`}
                expense={item.data}
                canEdit={item.data.createdBy?._id === currentUserId}
                onEdit={openEditDialog}
                onDelete={deleteExpense}
              />
            ) : (
              <SettlementCard key={`settlement-${item.data._id}`} settlement={item.data} />
            )
          )}
        </div>
      )}
    </div>
  );
}
