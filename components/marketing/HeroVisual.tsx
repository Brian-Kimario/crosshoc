"use client";

import { motion } from "framer-motion";

export function HeroVisual() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* Main Group Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="relative z-10"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 shadow-2xl"
          style={{ filter: "drop-shadow(0 24px 48px #10B98122)" }}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Wasakatonge</h4>
                <p className="text-xs text-slate-500">3 members</p>
              </div>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400">
              Active
            </span>
          </div>

          {/* Expense Row */}
          <div className="flex items-center justify-between py-3 border-t border-[#1E293B]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <span className="text-sm">🍔</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Dinner</p>
                <p className="text-xs text-slate-500">Paid by brian1small · Apr 23</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-200">$3,000.00</span>
          </div>

          {/* Balance Summary */}
          <div className="mt-4 pt-4 border-t border-[#1E293B]">
            <p className="text-xs font-medium text-slate-500 mb-3">Balance summary</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">brian1small</span>
                <span className="text-sm font-medium text-emerald-400">gets back $1,150 ✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Cench</span>
                <span className="text-sm font-medium text-rose-400">owes $1,250</span>
              </div>
            </div>
          </div>

          {/* Settle Up Button */}
          <button className="w-full mt-4 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition-colors">
            Settle Up
          </button>
        </motion.div>
      </motion.div>

      {/* Floating Notification Card */}
      <motion.div
        initial={{ y: 20, opacity: 0, x: 20 }}
        animate={{ y: 0, opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute -top-4 -right-4 z-20"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 shadow-xl"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-200">John Doe settled up</p>
              <p className="text-xs text-slate-500">$100.00 · just now</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Background Glow */}
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-30"
        style={{
          background: "radial-gradient(circle at center, #10B981 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
