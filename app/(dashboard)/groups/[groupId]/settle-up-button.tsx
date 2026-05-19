"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Banknote, Camera, X, AlertTriangle, Loader2 } from "lucide-react";
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
import { formatCurrency, getCurrencySymbol, type SupportedCurrency } from "@/lib/format-utils";

interface SettleUpButtonProps {
  fromUserId?: string;
  toUserId?: string;
  amount?: number;
  groupId?: string;
  fromName?: string;
  toName?: string;
  currency?: SupportedCurrency | string;
}

const paymentMethods = [
  { value: "cash", label: "Cash", emoji: "💵" },
  { value: "digital", label: "M-Pesa", emoji: "📱" },
  { value: "paypal", label: "PayPal", emoji: "💳" },
  { value: "bank", label: "Bank", emoji: "🏦" },
];

export function SettleUpButton({
  fromUserId,
  toUserId,
  amount,
  groupId,
  fromName = "Ower",
  toName = "Owner",
  currency = "USD",
}: SettleUpButtonProps) {
  const router = useRouter();
  const [isSettling, setIsSettling] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // amount comes in as CENTS (e.g., 1128183 for $11,281.83)
  // Store dollars in state for the input field
  const [dollarInput, setDollarInput] = useState<string>(
    amount ? (amount / 100).toFixed(2) : "0.00"
  );
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<"cash" | "digital" | "paypal" | "bank">("cash");
  const [proofUrl, setProofUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const symbol = getCurrencySymbol(currency);
  const amountCents = amount || 0; // Original full debt in cents
  const dollarAmount = amountCents / 100; // Full debt in dollars for validation

  const handleSettleUp = async () => {
    // Convert dollar input to cents for API
    const settlementCents = Math.round(parseFloat(dollarInput) * 100);

    if (!fromUserId || !toUserId || !groupId || settlementCents <= 0) {
      toast.error("Invalid settlement details");
      return;
    }

    if (settlementCents > amountCents) {
      toast.error(`Cannot exceed full debt of ${formatCurrency(amountCents, currency)}`);
      return;
    }

    setIsSettling(true);
    try {
      const body: any = {
        fromUserId,
        toUserId,
        amount: settlementCents, // Send cents to API
        method,
        note: note || undefined,
      };

      if (proofUrl) {
        body.proofUrl = proofUrl;
      }

      const response = await fetch(`/api/groups/${groupId}/settle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to record settlement");
        return;
      }

      toast.success(
        <div className="space-y-1">
          <p>Settlement recorded — pending confirmation</p>
          <p className="text-xs text-slate-400">
            {toName} needs to confirm they received {formatCurrency(settlementCents, currency)}
          </p>
        </div>
      );

      setIsOpen(false);
      resetForm();
      router.push("/settlements?tab=pending");
    } catch {
      toast.error("Failed to record settlement");
    } finally {
      setIsSettling(false);
    }
  };

  const resetForm = () => {
    setDollarInput(amount ? (amount / 100).toFixed(2) : "0.00");
    setNote("");
    setMethod("cash");
    setProofUrl("");
    setIsUploading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsOpen(open);
  };

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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger
        render={
          <button className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors">
            <CheckCircle className="size-4" />
            Settle Up
          </button>
        }
      />
      <DialogContent className="rounded-3xl bg-[#0F172A] border border-[#1E293B] text-slate-100 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <Banknote className="size-5 text-emerald-400" />
            Settle Up
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Record a payment from {fromName} to {toName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount summary */}
          <div className="text-center p-3 bg-[#1E293B] rounded-xl">
            <p className="text-sm text-slate-400 mb-1">{fromName} pays {toName}</p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrency(Math.round(parseFloat(dollarInput || "0") * 100), currency)}
            </p>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-slate-300">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{symbol}</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={dollarAmount}
                value={dollarInput}
                onChange={(e) => setDollarInput(e.target.value)}
                inputMode="decimal"
                className="pl-10 rounded-xl border-[#334155] bg-[#1E293B] text-slate-100 focus:border-emerald-500 focus:ring-emerald-500/20"
              />
            </div>
            <p className="text-xs text-slate-500">
              Full debt: {formatCurrency(amountCents, currency)}. You can edit for partial settlements.
            </p>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="text-slate-300">Payment method</Label>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value as any)}
                  className={`p-2 rounded-xl text-center transition-colors ${
                    method === m.value
                      ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400"
                      : "bg-[#1E293B] border border-[#334155] text-slate-400 hover:border-[#475569]"
                  }`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <p className="text-xs mt-1">{m.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-slate-300">Note (optional)</Label>
            <Input
              id="note"
              type="text"
              placeholder={`e.g., ${method === "cash" ? "Cash payment" : "M-Pesa confirmation #12345"}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-xl border-[#334155] bg-[#1E293B] text-slate-100 focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>

          {/* Proof upload */}
          <div className="space-y-2">
            <Label className="text-slate-300">Payment proof (strongly recommended)</Label>
            {proofUrl ? (
              <div className="relative rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={proofUrl}
                    alt="Payment proof"
                    className="w-12 h-12 rounded-lg object-cover bg-[#0F172A]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-emerald-400 truncate">Proof attached</p>
                    <p className="text-xs text-slate-500">Screenshot uploaded</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofUrl("")}
                    className="p-1 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("File size exceeds 10MB limit");
                      return;
                    }

                    setIsUploading(true);
                    const formData = new FormData();
                    formData.append("file", file);

                    try {
                      const response = await fetch("/api/upload/receipt", {
                        method: "POST",
                        body: formData,
                      });

                      const result = await response.json();

                      if (!response.ok || !result.success) {
                        throw new Error(result.error || "Upload failed");
                      }

                      setProofUrl(result.data.url);
                      toast.success("Proof uploaded!");
                    } catch (err: any) {
                      console.error("Upload error:", err);
                      toast.error(err.message || "Failed to upload proof");
                    } finally {
                      setIsUploading(false);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full rounded-xl border border-dashed border-[#334155] bg-[#1E293B]/50 hover:border-emerald-500/50 hover:bg-[#1E293B] transition-all flex flex-col items-center justify-center gap-2 py-4 text-slate-400 hover:text-emerald-400 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5" />
                      <span className="text-sm">Upload screenshot of your payment</span>
                      <span className="text-xs text-slate-500">
                        M-Pesa, PayPal, bank transfer receipt...
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Pending warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-800/30 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              <strong>Settlement won&apos;t be confirmed until {toName} verifies receipt.</strong>
              {" "}This prevents the frustration of "I paid but my balance didn't change."
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="rounded-xl border-[#334155] bg-transparent hover:bg-[#1E293B] text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSettleUp}
            disabled={isSettling || parseFloat(dollarInput) <= 0 || parseFloat(dollarInput) > dollarAmount}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isSettling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Record Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

