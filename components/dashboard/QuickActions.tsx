"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Share2, CheckCircle, Download, Receipt, X } from "lucide-react";

const actions = [
  {
    icon: Plus,
    label: "Add Expense",
    href: "/expenses",
    color: "text-teal-400",
    bgColor: "bg-teal-950",
  },
  {
    icon: Share2,
    label: "Share Group",
    href: "/groups",
    color: "text-blue-400",
    bgColor: "bg-blue-950",
  },
  {
    icon: CheckCircle,
    label: "Settle Up",
    href: "/settlements",
    color: "text-emerald-400",
    bgColor: "bg-emerald-950",
  },
  {
    icon: Download,
    label: "Export CSV",
    href: "#",
    color: "text-slate-400",
    bgColor: "bg-slate-800",
    onClick: "export",
  },
];

export function QuickActions() {
  const [exportModalOpen, setExportModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <motion.div
              whileHover={{ borderColor: "#10B98160" }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-xl text-sm text-slate-300 hover:text-slate-100 transition-all cursor-pointer"
            >
              <div className={`w-6 h-6 rounded-lg ${action.bgColor} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${action.color}`} />
              </div>
              <span>{action.label}</span>
            </motion.div>
          );

          if (action.onClick === "export") {
            return (
              <button key={action.label} onClick={() => setExportModalOpen(true)}>
                {content}
              </button>
            );
          }

          return (
            <Link key={action.label} href={action.href}>
              {content}
            </Link>
          );
        })}
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {exportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setExportModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-100">Export Data</h3>
                <button
                  onClick={() => setExportModalOpen(false)}
                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-6">
                Select a group to export its data as CSV. This includes all expenses,
                splits, and settlements.
              </p>

              <div className="space-y-3">
                <Link href="/groups">
                  <div className="flex items-center gap-3 p-4 bg-[#1E293B] border border-[#334155] rounded-xl hover:border-[#10B981] transition-all cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-[#10B98120] flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">Select from your groups</p>
                      <p className="text-xs text-slate-500">Choose a group to export</p>
                    </div>
                  </div>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
