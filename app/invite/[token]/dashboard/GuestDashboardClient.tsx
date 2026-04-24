"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle,
  CreditCard,
  Receipt,
  UserPlus,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";

interface Debt {
  creditorId: string;
  creditorName: string;
  amount: number;
  expenseIds: string[];
}

interface GuestDashboardClientProps {
  token: string;
  guestId: string;
  guestName: string;
  groupName: string;
  groupId: string;
  currency: SupportedCurrency;
  debts: Debt[];
  totalOwed: number;
}

export default function GuestDashboardClient({
  token,
  guestId,
  guestName,
  groupName,
  groupId,
  currency,
  debts,
  totalOwed,
}: GuestDashboardClientProps) {
  const router = useRouter();
  const [settlingCreditorId, setSettlingCreditorId] = useState<string | null>(null);
  const [showClaimCTA, setShowClaimCTA] = useState(false);

  async function handleSettle(creditorId: string, amount: number) {
    setSettlingCreditorId(creditorId);
    try {
      const res = await fetch("/api/guest/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          creditorId,
          amount,
          note: `Payment from ${guestName}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to record settlement");
        return;
      }

      toast.success("Settlement recorded!");
      // Refresh the page to update balances
      router.refresh();
    } catch {
      toast.error("Failed to record settlement");
    } finally {
      setSettlingCreditorId(null);
    }
  }

  function handleClaimAccount() {
    const redirectPath = `/invite/${token}/dashboard`;
    router.push(
      `/register?claimGuestId=${encodeURIComponent(guestId)}&groupId=${encodeURIComponent(groupId)}&redirect=${encodeURIComponent(redirectPath)}`
    );
  }

  if (debts.length === 0) {
    return (
      <div className="min-h-screen bg-[#0F172A] p-6">
        <div className="max-w-md mx-auto pt-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">All Settled!</h1>
            <p className="text-slate-400">
              You don&apos;t owe anything in <span className="text-emerald-400">{groupName}</span>
            </p>
          </div>

          {/* Claim CTA */}
          <Card className="bg-slate-800/50 border-slate-700 rounded-3xl">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-slate-300">
                Want to track your own splits and keep history? Create a free account.
              </p>
              <Button
                onClick={handleClaimAccount}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Free Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-md mx-auto pt-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm text-slate-400 uppercase tracking-wider mb-2">
            Guest view for
          </p>
          <h1 className="text-3xl font-bold text-white">{groupName}</h1>
          <p className="text-slate-400 mt-1">
            Signed in as <span className="text-emerald-400">{guestName}</span>
          </p>
        </div>

        {/* Total Owed Card */}
        <Card className="bg-linear-to-br from-emerald-900/40 to-slate-800 border-emerald-500/30 rounded-3xl">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-emerald-300 mb-1">You owe in total</p>
            <p className="text-4xl font-bold text-white">
              {formatCurrency(totalOwed, currency)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {debts.length} person{debts.length !== 1 ? "s" : ""} to settle with
            </p>
          </CardContent>
        </Card>

        {/* Settle Up Button */}
        {debts.length === 1 && !showClaimCTA && (
          <Button
            onClick={() => setShowClaimCTA(true)}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-lg font-medium"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Settle Up {formatCurrency(totalOwed, currency)}
          </Button>
        )}

        {/* Debts List */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Breakdown
          </p>
          {debts.map((debt) => (
            <Card
              key={debt.creditorId}
              className="bg-slate-800/50 border-slate-700 rounded-2xl"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{debt.creditorName}</p>
                  <p className="text-xs text-slate-400">
                    {debt.expenseIds.length} expense
                    {debt.expenseIds.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-rose-400">
                    {formatCurrency(debt.amount, currency)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleSettle(debt.creditorId, debt.amount)}
                    disabled={settlingCreditorId === debt.creditorId}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
                  >
                    {settlingCreditorId === debt.creditorId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Pay
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="pt-4 border-t border-slate-800">
          <Button
            variant="ghost"
            onClick={handleClaimAccount}
            className="w-full text-slate-400 hover:text-emerald-400 hover:bg-transparent"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Want to track your own splits? Create a free account
          </Button>
        </div>
      </div>
    </div>
  );
}
