"use client";

import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
  brandPanel: React.ReactNode;
}

export function AuthLayout({ children, brandPanel }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] flex">
      {/* Left Panel - Brand (hidden on mobile) */}
      <div className="hidden md:flex w-1/2 min-h-screen flex-col relative overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, #0F172A 0%, #0D1F1A 60%, #0F172A 100%)",
          }}
        />
        
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 30% 60%, #10B98112 0%, transparent 70%)",
          }}
        />

        {/* Border */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-[#1E293B]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-8 lg:p-12">
          {brandPanel}
        </div>
      </div>

      {/* Right Panel - Form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full md:w-1/2 min-h-screen flex items-center justify-center p-6 sm:p-8 lg:p-12"
      >
        <div className="w-full max-w-[400px]">{children}</div>
      </motion.div>
    </div>
  );
}
