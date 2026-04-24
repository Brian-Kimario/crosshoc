"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Banknote } from "lucide-react";
import { toast } from "sonner";

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
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";

interface PayGuestButtonProps {
  /** The registered member who owes money */
  fromUserId: string;
  fromName: string;
  /** The guest being paid */
  guestId: string;
  guestName: string;
  /** Amount owed */
  amount: number;
  groupId: string;
  currency?: SupportedCurrency | string;
}

export function PayGuestButton({
  fromUserId,
  fromName,
  guestId,
  guestName,
  amount,
  groupId,
  currency = "USD",
}: PayGuestButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState(amount);
  const [note, setNote] = useState("");

  const handlePay = async () => {
    if (settlementAmount <= 0 || settlementAmount > amount) return;

    setSettling(true);
    try {
      const res = await fetch("/api/guest/settle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          guestId,
          guestName,
          fromUserId,
          amount: settlementAmount,
          note: note || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to record payment");
        return;
      }

      toast.success(
        `${formatCurrency(settlementAmount, currency)} marked as paid to ${guestName}`
      );
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setSettling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors">
            <UserCheck className="size-4" />
            Pay Guest
          </button>
        }
      />

      <DialogContent className="rounded-3xl bg-slate-900 border border-slate-700 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-400" />
            Pay Guest: {guestName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Record that <span className="text-white font-medium">{fromName}</span> paid{" "}
            <span className="text-emerald-300 font-medium">{guestName}</span> outside the app.
            This will update the balance summary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info banner */}
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <p className="text-xs text-emerald-300">
              💡 {guestName} is a guest and hasn&apos;t created an account yet. Once they sign up,
              their balance will be transferred to their permanent account.
            </p>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-slate-300">Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={amount}
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(Number(e.target.value))}
              className="rounded-2xl border-slate-700 bg-slate-800 text-white focus:border-emerald-500"
            />
            <p className="text-xs text-slate-500">
              Full debt: {formatCurrency(amount, currency)}. You can enter a partial amount.
            </p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-slate-300">Note (optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Paid via M-Pesa"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-2xl border-slate-700 bg-slate-800 text-white focus:border-emerald-500"
            />
          </div>

          {/* Summary */}
          <div className="rounded-2xl bg-slate-800/80 border border-slate-700 p-4">
            <p className="text-sm text-slate-300">
              Confirming{" "}
              <span className="font-semibold text-white">{fromName}</span> paid{" "}
              <span className="font-semibold text-emerald-400">
                {formatCurrency(settlementAmount, currency)}
              </span>{" "}
              to guest{" "}
              <span className="font-semibold text-emerald-300">{guestName}</span>
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
            onClick={handlePay}
            disabled={settling || settlementAmount <= 0 || settlementAmount > amount}
            className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {settling ? "Recording..." : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
