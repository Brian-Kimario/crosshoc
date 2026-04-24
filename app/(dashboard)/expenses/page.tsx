"use client";

import { motion } from "framer-motion";
import { Receipt, Clock } from "lucide-react";

export default function ExpensesPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Expenses</h1>
          <p className="text-slate-400 mb-6">
            Global expense tracking and management coming soon.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>Under Construction</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
