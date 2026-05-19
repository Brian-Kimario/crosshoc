"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet } from "lucide-react";
import { NeedsActionTab } from "@/components/settlements/NeedsActionTab";
import { PendingTab } from "@/components/settlements/PendingTab";
import { HistoryTab } from "@/components/settlements/HistoryTab";
import { useSettlements, useNeedsActionCount } from "@/hooks/use-settlements";

type Tab = "needs-action" | "pending" | "history";

const TAB_PARAM_MAP: Record<string, Tab> = {
  "needs-action": "needs-action",
  "pending": "pending",
  "history": "history",
};

export default function SettlementsPage() {
  const searchParams = useSearchParams();
  const initialTab = TAB_PARAM_MAP[searchParams.get("tab") ?? ""] ?? "needs-action";

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Use SWR for settlements data
  const { settlements, isLoading } = useSettlements(activeTab);
  const { count: needsActionCount, mutate: refreshCount } = useNeedsActionCount();

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handleActionComplete = () => {
    // Revalidate settlements and count
    refreshCount();
  };

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    {
      id: "needs-action",
      label: "Needs Action",
      badge: needsActionCount > 0 ? needsActionCount : undefined,
    },
    { id: "pending", label: "Pending" },
    { id: "history", label: "History" },
  ];

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page header skeleton */}
        <div className="space-y-2">
          <div className="h-6 w-32 bg-[#1E293B] rounded animate-pulse" />
          <div className="h-4 w-48 bg-[#1E293B] rounded animate-pulse" />
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-1 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-10 bg-[#1E293B] rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#1E293B]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#1E293B] rounded w-1/2" />
                  <div className="h-3 bg-[#1E293B] rounded w-1/3" />
                </div>
                <div className="h-5 bg-[#1E293B] rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="size-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-slate-100">Settlements</h1>
        </div>
        <p className="text-sm text-slate-500">
          Track and verify payments across your groups
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0A0F1E] border border-[#1E293B] rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#1E293B] text-slate-100 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="inline-flex items-center justify-center size-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {tab.badge > 9 ? "9+" : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "needs-action" && (
        <NeedsActionTab
          settlements={settlements}
          onActionComplete={handleActionComplete}
        />
      )}
      {activeTab === "pending" && (
        <PendingTab
          settlements={settlements}
          onActionComplete={handleActionComplete}
        />
      )}
      {activeTab === "history" && (
        <HistoryTab settlements={settlements} />
      )}
    </div>
  );
}
