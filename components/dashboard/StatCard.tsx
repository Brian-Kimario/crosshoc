"use client";

import { motion } from "framer-motion";
import { Users, ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

interface StatCardProps {
  type: "groups" | "owed" | "owe";
  value: string | number;
  label: string;
  trend?: string;
  subtext?: string;
  groupNames?: string[];
  showWarning?: boolean;
  delay?: number;
}

const iconConfig = {
  groups: {
    icon: Users,
    bgColor: "bg-violet-950",
    iconColor: "text-violet-400",
  },
  owed: {
    icon: ArrowDownLeft,
    bgColor: "bg-emerald-950",
    iconColor: "text-emerald-400",
  },
  owe: {
    icon: ArrowUpRight,
    bgColor: "bg-rose-950",
    iconColor: "text-rose-400",
  },
};

export function StatCard({
  type,
  value,
  label,
  trend,
  subtext,
  groupNames = [],
  showWarning = false,
  delay = 0,
}: StatCardProps) {
  const config = iconConfig[type];
  const Icon = config.icon;

  const getValueColor = () => {
    if (type === "owed") return value === 0 || value === "$0.00" ? "text-slate-500" : "text-emerald-400";
    if (type === "owe") return value === 0 || value === "$0.00" ? "text-slate-500" : "text-rose-400";
    return "text-slate-100";
  };

  const formatValue = () => {
    if (type === "groups") return value;
    if (value === 0 || value === "$0.00") {
      return type === "owed" ? "All settled up ✓" : type === "owe" ? "You owe nothing ✓" : value;
    }
    return value;
  };

  const isZero = value === 0 || value === "$0.00";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, borderColor: "#334155" }}
      className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>

        {trend && type === "groups" && (
          <span className="text-xs text-slate-600">{trend}</span>
        )}

        {type === "owed" && !isZero && (
          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full">
            <TrendingUp className="w-3 h-3" />
            <span>+12% mtd</span>
          </div>
        )}

        {type === "owe" && !isZero && (
          <Link href="/settlements">
            <div className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 px-2 py-0.5 rounded-full transition-colors cursor-pointer">
              Pay now
            </div>
          </Link>
        )}
      </div>

      {/* Value */}
      <div className="mb-1">
        <span className={`text-3xl font-bold ${getValueColor()}`}>
          {formatValue()}
        </span>
      </div>

      {/* Label */}
      <p className="text-sm text-slate-400">{label}</p>

      {/* Divider */}
      <div className="h-px bg-[#1E293B] my-4" />

      {/* Footer */}
      {type === "groups" && groupNames.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {groupNames.slice(0, 3).map((name, index) => (
            <span
              key={index}
              className="px-2 py-0.5 text-xs text-slate-400 bg-[#1E293B] rounded-full"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600">{subtext}</p>
      )}

      {/* Warning for large balance */}
      {showWarning && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 px-2 py-1.5 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Large balance — verify your data</span>
        </div>
      )}
    </motion.div>
  );
}

// Import Link for the pay now button
import Link from "next/link";
