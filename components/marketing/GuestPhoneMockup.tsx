"use client";

import { motion } from "framer-motion";

export function GuestPhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative mx-auto"
      style={{ maxWidth: "280px" }}
    >
      {/* Phone Frame */}
      <div
        className="relative rounded-[40px] p-6"
        style={{
          border: "1.5px solid #1E293B",
          background: "#0F172A",
          boxShadow: "0 40px 80px #00000066, 0 0 0 8px #0F172A",
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#0A0F1E] rounded-b-2xl" />

        {/* Screen Content */}
        <div className="pt-6 space-y-4">
          {/* Badge */}
          <div className="flex justify-center">
            <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✦ You've been invited
            </span>
          </div>

          {/* Heading */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-100">Hi, Cench</h3>
            <p className="text-sm text-slate-500 mt-1">
              You have balances in Wasakatonge
            </p>
          </div>

          {/* Debt Rows */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">Dinner</span>
              </div>
              <span className="text-sm font-semibold text-rose-400">- $750.00</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">Taxi</span>
              </div>
              <span className="text-sm font-semibold text-rose-400">- $500.00</span>
            </div>
          </div>

          {/* Total */}
          <div className="pt-2 border-t border-[#1E293B]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total you owe</span>
              <span className="text-lg font-bold text-rose-400">$1,250</span>
            </div>
          </div>

          {/* CTA Button */}
          <button className="w-full py-3 rounded-full bg-emerald-500 text-white font-medium hover:bg-emerald-400 transition-colors">
            Settle Up — $1,250
          </button>

          {/* Footer Link */}
          <p className="text-center text-xs text-slate-500">
            <a href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">
              Create free account →
            </a>
          </p>
        </div>
      </div>

      {/* Decorative Elements */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-8 blur-xl opacity-50"
        style={{ background: "#10B981" }}
      />
    </motion.div>
  );
}
