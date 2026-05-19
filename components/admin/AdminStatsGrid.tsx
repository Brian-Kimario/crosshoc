"use client";

import { formatCurrency } from "@/lib/format-utils";
import type { SupportedCurrency } from "@/lib/format-utils";
import {
  Users, FolderOpen, Receipt,
  AlertTriangle, DollarSign, ArrowLeftRight,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  newUsers7d: number;
  totalGroups: number;
  activeGroups7d: number;
  totalExpenses: number;
  expensesToday: number;
  totalSettlements: number;
  pendingSettlements: number;
  disputedSettlements: number;
  platformVolumeCents: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "violet",
  alert = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  alert?: boolean;
}) {
  const colors: Record<string, string> = {
    violet:  "bg-violet-950 text-violet-400",
    teal:    "bg-teal-950 text-teal-400",
    blue:    "bg-blue-950 text-blue-400",
    amber:   "bg-amber-950 text-amber-400",
    rose:    "bg-rose-950 text-rose-400",
    emerald: "bg-emerald-950 text-emerald-400",
  };

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {alert && (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-medium">
            Review
          </span>
        )}
      </div>

      <p className="mt-3 text-2xl font-semibold text-slate-200">
        {value}
      </p>

      <p className="text-sm text-slate-500">{label}</p>

      {sub && (
        <p className="text-xs text-slate-600 mt-1">
          {sub}
        </p>
      )}
    </div>
  );
}

export function AdminStatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <StatCard
        icon={Users}
        label="Total Users"
        value={stats.totalUsers.toLocaleString()}
        sub={`+${stats.newUsersToday} today · +${stats.newUsers7d} this week`}
        color="violet"
      />
      <StatCard
        icon={FolderOpen}
        label="Groups"
        value={stats.totalGroups.toLocaleString()}
        sub={`${stats.activeGroups7d} active this week`}
        color="teal"
      />
      <StatCard
        icon={Receipt}
        label="Expenses"
        value={stats.totalExpenses.toLocaleString()}
        sub={`+${stats.expensesToday} today`}
        color="blue"
      />
      <StatCard
        icon={ArrowLeftRight}
        label="Settlements"
        value={stats.totalSettlements.toLocaleString()}
        sub={`${stats.pendingSettlements} pending`}
        color="emerald"
      />
      <StatCard
        icon={AlertTriangle}
        label="Disputes"
        value={stats.disputedSettlements}
        sub="Require admin review"
        color={stats.disputedSettlements > 0 ? "rose" : "emerald"}
        alert={stats.disputedSettlements > 0}
      />
      <StatCard
        icon={DollarSign}
        label="Platform Volume"
        value={formatCurrency(stats.platformVolumeCents, "USD")}
        sub="All time"
        color="amber"
      />
    </div>
  );
}
