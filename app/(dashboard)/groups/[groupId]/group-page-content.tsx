"use client";

import { useState, useCallback } from "react";
import { Plus, Receipt, BarChart2 } from "lucide-react";
import { ExpensesSection } from "./expenses-section";
import { Button } from "@/components/ui/button";
import { type SupportedCurrency } from "@/lib/format-utils";
import { GroupAnalyticsPanel } from "@/components/analytics/GroupAnalyticsPanel";

interface Member {
  id: string;
  name: string;
}

interface GroupPageContentProps {
  groupId: string;
  currency: SupportedCurrency | string;
  members: Member[];
  sidebarContent: React.ReactNode;
  currentUserId: string;
}

type ActiveTab = "expenses" | "analytics";

export function GroupPageContent({ groupId, currency, members, sidebarContent, currentUserId }: GroupPageContentProps) {
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("expenses");

  const handleAddExpense = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).__spliteasy_openExpenseDialog) {
      (window as any).__spliteasy_openExpenseDialog();
    }
  }, []);

  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-[1fr_340px]">
      {/* Main content - Feed first on mobile */}
      <div className="min-w-0 space-y-4 lg:space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/50 w-fit">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "expenses"
                ? "bg-slate-700 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/50"
            }`}
          >
            <Receipt className="size-4" />
            Expenses
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "analytics"
                ? "bg-slate-700 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/50"
            }`}
          >
            <BarChart2 className="size-4" />
            Analytics
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "expenses" ? (
          <>
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
          </>
        ) : (
          <GroupAnalyticsPanel
            groupId={groupId}
            currency={currency}
            currentUserId={currentUserId}
          />
        )}
      </div>

      {/* Desktop: Sidebar on right */}
      <div className="hidden lg:block space-y-6">
        {sidebarContent}
      </div>
    </div>
  );
}
