"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { ExpensesSection } from "./expenses-section";
import { Button } from "@/components/ui/button";
import { type SupportedCurrency } from "@/lib/format-utils";

interface Member {
  id: string;
  name: string;
}

interface GroupPageContentProps {
  groupId: string;
  currency: SupportedCurrency | string;
  members: Member[];
  sidebarContent: React.ReactNode;
}

export function GroupPageContent({ groupId, currency, members, sidebarContent }: GroupPageContentProps) {
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);

  const handleAddExpense = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).__spliteasy_openExpenseDialog) {
      (window as any).__spliteasy_openExpenseDialog();
    }
  }, []);

  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-[1fr_340px]">
      {/* Main content - Feed first on mobile */}
      <div className="min-w-0 space-y-4 lg:space-y-6">
        <ExpensesSection
          groupId={groupId}
          currency={currency}
          members={members}
          onOpenChange={setIsExpenseFormOpen}
        />

        {/* Mobile: Sidebar content appears after feed */}
        <div className="lg:hidden">
          {sidebarContent}
        </div>

        {/* Mobile Floating Action Button */}
        {!isExpenseFormOpen && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-linear-to-t from-slate-900 via-slate-900/95 to-transparent z-40">
            <div className="flex items-center justify-center">
              <Button
                onClick={handleAddExpense}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 py-3 h-auto shadow-lg shadow-emerald-900/30 min-h-11"
              >
                <Plus className="size-5 mr-2" />
                Add Expense
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Sidebar on right */}
      <div className="hidden lg:block space-y-6">
        {sidebarContent}
      </div>
    </div>
  );
}
