"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Settings, HelpCircle, MessageSquare,
  LogOut, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useUIStore } from "@/lib/store/ui-store";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function MobileSidebarDrawer({
  userName,
  userEmail,
  userAvatarUrl,
}: {
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
}) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const pathname = usePathname();

  // Auto-close on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSidebarOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.setProperty("--scroll-y", `-${scrollY}px`);
      document.body.classList.add("overflow-locked");
    } else {
      const scrollY = document.documentElement.style.getPropertyValue("--scroll-y");
      document.body.classList.remove("overflow-locked");
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }

    return () => {
      document.body.classList.remove("overflow-locked");
    };
  }, [sidebarOpen]);

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      // Silent fail - redirect anyway
      window.location.href = "/login";
    }
  }

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0F172A] border-r border-[#1E293B] md:hidden"
          >
            {/* Header row */}
            <div className="flex items-center justify-between p-4 border-b border-[#1E293B]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/20 flex items-center justify-center">
                  <span className="text-[#10B981] font-bold text-sm">S</span>
                </div>
                <span className="font-semibold text-slate-200">SplitEasy</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl hover:bg-[#1E293B] text-slate-500 hover:text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-3">
              {/* Additional nav items not in bottom tab bar */}
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wider px-3 mb-2">
                  More
                </p>

                {[
                  { href: "/settings", label: "Settings", Icon: Settings },
                  { href: "/help", label: "Help & Support", Icon: HelpCircle },
                  { href: "/feedback", label: "Feedback", Icon: MessageSquare },
                ].map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </Link>
                ))}
              </div>
            </div>

            {/* User card + sign out — pinned to bottom */}
            <div className="border-t border-[#1E293B] p-4">
              {/* User info */}
              <div className="flex items-center gap-3 mb-3">
                <UserAvatar name={userName} avatarUrl={userAvatarUrl} size={40} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {userEmail}
                  </p>
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-rose-400 hover:bg-rose-950/30 transition-all w-full min-h-[48px]"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
