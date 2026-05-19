"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { useState } from "react";
import { Plus, CheckCircle } from "lucide-react";
import { SettleUpButton } from "./settle-up-button";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";

interface MobileActionBarProps {
  currentUserId: string;
  groupId: string;
  currency: SupportedCurrency;
  simplifiedDebts: Array<{
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number;
  }>;
}

export function MobileActionBar({
  currentUserId,
  groupId,
  currency,
  simplifiedDebts,
}: MobileActionBarProps) {
  
  // Check if current user has debts to pay
  const currentUserDebts = simplifiedDebts.filter((d) => d.from === currentUserId);
  const currentUserHasDebts = currentUserDebts.length > 0;

  // Get the first debt for the settle up button (if multiple, user can settle multiple times)
  const firstDebt = currentUserDebts[0];

  return (
    <>
      {/* Mobile sticky action bar - positioned above bottom tab bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 bg-[#0A0F1E]/95 backdrop-blur-md border-t border-[#1E293B]/50 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {/* Settle Up - only if current user owes money */}
          {currentUserHasDebts && firstDebt && (
            <SettleUpButton
              fromUserId={firstDebt.from}
              toUserId={firstDebt.to}
              amount={firstDebt.amount}
              groupId={groupId}
              fromName={firstDebt.fromName}
              toName={firstDebt.toName}
              currency={currency}
            />
          )}
        </div>
      </div>

      {/* Spacer: tab bar (64px) + action bar (~68px) + padding */}
      <div className="lg:hidden h-36" />
    </>
  );
}
