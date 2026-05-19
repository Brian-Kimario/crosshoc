"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
  wide?: boolean;
  delay?: number;
}

export function FeatureCard({
  icon: Icon,
  title,
  body,
  badge,
  wide = false,
  delay = 0,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, borderColor: "#10B98140" }}
      className={`relative bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 transition-all duration-300 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      {/* Badge */}
      {badge && (
        <span className="absolute top-4 right-4 px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400">
          {badge}
        </span>
      )}

      {/* Icon */}
      <div className="w-fit p-3 rounded-xl bg-emerald-950 mb-4">
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
    </motion.div>
  );
}
