"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Member {
  _id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string;
}

interface GroupCardProps {
  _id: string;
  name: string;
  memberCount: number;
  expenseCount: number;
  lastActivity?: string;
  balance: {
    amount: number;
    type: "positive" | "negative" | "neutral";
    label: string;
  };
  members: Member[];
  colorIndex: number;
  delay?: number;
}

const dotColors = [
  "bg-teal-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-rose-500",
];

export function GroupCard({
  _id,
  name,
  memberCount,
  expenseCount,
  lastActivity,
  balance,
  members,
  colorIndex,
  delay = 0,
}: GroupCardProps) {
  const dotColor = dotColors[colorIndex % dotColors.length];

  const getBalanceColor = () => {
    if (balance.type === "positive") return "text-emerald-400";
    if (balance.type === "negative") return "text-rose-400";
    return "text-slate-500";
  };

  const formatDate = (date?: string) => {
    if (!date) return "No activity yet";
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Link href={`/groups/${_id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay }}
        whileHover={{ y: -3, borderColor: "#334155" }}
        className="group bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden"
      >
        {/* Hover overlay button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="bg-[#10B981] text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1">
            Open
            <ArrowRight className="w-3 h-3" />
          </div>
        </motion.div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <h3 className="font-semibold text-slate-100 truncate">{name}</h3>
        </div>

        {/* Meta info */}
        <p className="text-xs text-slate-500 mb-4">
          {memberCount} members · {expenseCount} expenses · {formatDate(lastActivity)}
        </p>

        {/* Balance */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-1">Your balance:</p>
          <p className={`text-lg font-semibold ${getBalanceColor()}`}>
            {balance.label} ${Math.abs(balance.amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Member avatars */}
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((member) => (
              <UserAvatar
                key={member._id}
                name={member.name}
                avatarUrl={member.avatarUrl}
                size={24}
                className="border-2 border-[#0F172A]"
              />
            ))}
          </div>
          {members.length > 4 && (
            <span className="ml-2 text-xs text-slate-500">
              +{members.length - 4} more
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
