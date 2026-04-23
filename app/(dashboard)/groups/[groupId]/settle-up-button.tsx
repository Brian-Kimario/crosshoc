"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Banknote } from "lucide-react";
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
import { toast } from "sonner";

interface SettleUpButtonProps {
  fromUserId?: string;
  toUserId?: string;
  amount?: number;
  groupId?: string;
  fromName?: string;
  toName?: string;
}

export function SettleUpButton({
  fromUserId,
  toUserId,
  amount,
  groupId,
  fromName = "Ower",
  toName = "Owner",
}: SettleUpButtonProps) {
  const router = useRouter();
  const [isSettling, setIsSettling] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<number>(amount || 0);
  const [note, setNote] = useState("");

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleSettleUp = async (method: "cash" | "digital" | "other" = "cash") => {
    if (!fromUserId || !toUserId || !groupId || settlementAmount <= 0) {
      toast.error("Invalid settlement details");
      return;
    }

    setIsSettling(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/settle`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromUserId,
          toUserId,
          amount: settlementAmount,
          method,
          note: note || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to record settlement");
        return;
      }

      toast.success(
        `Settlement recorded! ${formatCurrency(settlementAmount)} marked as paid from ${fromName} to ${toName}.`
      );

      // Close dialog and refresh
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to record settlement");
    } finally {
      setIsSettling(false);
    }
  };

  // If no valid props, show disabled button
  if (!fromUserId || !toUserId || !groupId || !amount) {
    return (
      <Button
        disabled
        variant="outline"
        size="sm"
        className="w-full border-slate-600 bg-slate-700/50 text-slate-400"
      >
        <CheckCircle className="size-4 mr-2" />
        Settle Up
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <button className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors">
          <CheckCircle className="size-4" />
          Settle Up
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl bg-slate-900 border border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Banknote className="size-5 text-emerald-400" />
            Confirm Settlement
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Record a payment from {fromName} to {toName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-slate-300">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={amount}
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(Number(e.target.value))}
                className="pl-7 rounded-2xl border-slate-700 bg-slate-800 text-white focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            <p className="text-xs text-slate-500">
              Full debt: {formatCurrency(amount)}. You can edit for partial settlements.
            </p>
          </div>

          {/* Note Input */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-slate-300">
              Note (optional)
            </Label>
            <Input
              id="note"
              type="text"
              placeholder="e.g., Cash payment at coffee shop"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-2xl border-slate-700 bg-slate-800 text-white focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          {/* Summary */}
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700 p-4">
            <p className="text-sm text-slate-300">
              Confirming cash payment of{" "}
              <span className="font-semibold text-emerald-400">
                {formatCurrency(settlementAmount)}
              </span>{" "}
              from{" "}
              <span className="font-medium text-white">{fromName}</span> to{" "}
              <span className="font-medium text-emerald-300">{toName}</span>?
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="rounded-2xl border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleSettleUp("cash")}
            disabled={isSettling || settlementAmount <= 0 || settlementAmount > amount}
            className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isSettling ? "Recording..." : "Confirm Cash Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
