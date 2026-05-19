"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { Plus } from "lucide-react";

export function DashboardOverviewButton() {
  const { setCreateGroupOpen } = useUIStore();

  return (
    <button
      onClick={() => setCreateGroupOpen(true)}
      className="border-2 border-dashed border-[#334155] rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-[#10B98150] hover:text-teal-500 transition-all min-h-45 cursor-pointer bg-transparent h-full"
    >
      <Plus className="w-6 h-6" />
      <span className="font-medium">New group</span>
      <span className="text-xs text-slate-500">or join with an invite link</span>
    </button>
  );
}
