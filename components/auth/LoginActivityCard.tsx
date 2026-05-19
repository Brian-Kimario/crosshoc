"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Receipt, CheckCircle, UserPlus, Sparkles, PartyPopper } from "lucide-react";

interface ActivityItem {
  id: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  meta: string;
}

const activities: ActivityItem[] = [
  {
    id: 1,
    icon: Receipt,
    iconBg: "#10B98120",
    iconColor: "#10B981",
    title: "brian1small added an expense",
    subtitle: "Dinner · Wasakatonge",
    meta: "$3,000.00 split 3 ways  ·  now",
  },
  {
    id: 2,
    icon: CheckCircle,
    iconBg: "#10B98120",
    iconColor: "#10B981",
    title: "Cench settled up",
    subtitle: "$1,250.00 → brian1small",
    meta: "Proof attached  ·  2 min ago",
  },
  {
    id: 3,
    icon: UserPlus,
    iconBg: "#3B82F620",
    iconColor: "#3B82F6",
    title: "John Doe joined via link",
    subtitle: "Weekend Trip · Guest access",
    meta: "Owes $400.00  ·  5 min ago",
  },
  {
    id: 4,
    icon: Sparkles,
    iconBg: "#8B5CF620",
    iconColor: "#8B5CF6",
    title: "New group created",
    subtitle: '"Bali Trip 2025" · 4 members',
    meta: "First expense added  ·  12m ago",
  },
  {
    id: 5,
    icon: PartyPopper,
    iconBg: "#F59E0B20",
    iconColor: "#F59E0B",
    title: "All debts cleared!",
    subtitle: "Mombasa Trip · Everyone settled",
    meta: "$8,400 total split  ·  1h ago",
  },
];

function Card({ item, isActive }: { item: ActivityItem; isActive: boolean }) {
  const Icon = item.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{
        opacity: isActive ? 1 : 0,
        y: isActive ? 0 : 20,
        scale: isActive ? 1 : 0.95,
      }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="absolute inset-0"
    >
      <div className="bg-[#1E293B]/90 backdrop-blur-sm border border-[#334155] rounded-2xl p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: item.iconBg }}
          >
            <Icon className="w-5 h-5" style={{ color: item.iconColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100">{item.title}</p>
            <p className="text-sm text-slate-400 mt-0.5">{item.subtitle}</p>
            <p className="text-xs text-slate-500 mt-1">{item.meta}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function LoginActivityCard() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const currentItem = activities[currentIndex];

  return (
    <div className="relative w-full max-w-[320px] mx-auto">
      {/* Ghost cards for depth effect */}
      <div
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[94%] h-full rounded-2xl bg-[#1E293B]/30 border border-[#334155]/30"
        style={{ transform: "translateX(-50%) scale(0.97)" }}
      />
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[88%] h-full rounded-2xl bg-[#1E293B]/15 border border-[#334155]/20"
        style={{ transform: "translateX(-50%) scale(0.94)" }}
      />

      {/* Active card container */}
      <div className="relative h-[100px]">
        <AnimatePresence mode="wait">
          <Card key={currentItem.id} item={currentItem} isActive={true} />
        </AnimatePresence>
      </div>
    </div>
  );
}
