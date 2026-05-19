"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { LoginActivityCard } from "./LoginActivityCard";

export function AuthBrandPanel() {
  return (
    <>
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <span className="text-xl font-semibold text-slate-100">SplitEasy</span>
      </motion.div>

      {/* Main content - centered */}
      <div className="flex-1 flex flex-col justify-center items-center py-12">
        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-2xl lg:text-3xl font-semibold text-slate-100 text-center mb-10"
        >
          Real people.
          <br />
          Real splits.
          <br />
          Settled instantly.
        </motion.h2>

        {/* Activity card stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full mb-10"
        >
          <LoginActivityCard />
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex items-center gap-4"
        >
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-[#0F172A] flex items-center justify-center">
              <span className="text-xs font-medium text-emerald-400">BK</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-[#0F172A] flex items-center justify-center">
              <span className="text-xs font-medium text-blue-400">JD</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border-2 border-[#0F172A] flex items-center justify-center">
              <span className="text-xs font-medium text-violet-400">AL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm text-slate-500">Trusted by groups worldwide</span>
          </div>
        </motion.div>
      </div>

      {/* Back link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-400 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to SplitEasy
        </Link>
      </motion.div>
    </>
  );
}
