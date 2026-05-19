"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useUIStore } from "@/lib/store/ui-store";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ArrowLeftRight,
  UserCircle,
  LogOut,
  X,
} from "lucide-react";

const tabs = [
  {
    label: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: false,
  },
  {
    label: "Groups",
    href: "/groups",
    icon: Users,
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
  },
  {
    label: "Settle",
    href: "/settlements",
    icon: ArrowLeftRight,
  },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { setGroupSelectOpen } = useUIStore();

  function isActive(tab: (typeof tabs)[0]) {
    if (tab.exact !== false) return pathname === tab.href;
    // For /dashboard, only match /dashboard and /dashboard/*
    return pathname === tab.href || pathname.startsWith(tab.href + "/");
  }

  const isProfileActive = pathname === "/settings" || pathname === "/profile";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
      setProfileMenuOpen(false);
    }
  }

  return (
    <>
      {/* Profile Menu Overlay */}
      {profileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
          onClick={() => setProfileMenuOpen(false)}
        >
          <div 
            className="absolute bottom-20 left-4 right-4 bg-[#0F172A] border border-[#1E293B] rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-200 font-medium">Account</span>
              <button 
                onClick={() => setProfileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <Link
              href="/settings"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] transition-colors mb-3"
            >
              <UserCircle className="w-5 h-5 text-[#10B981]" />
              <span className="text-slate-200">Settings</span>
            </Link>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-rose-400"
            >
              <LogOut className="w-5 h-5" />
              <span>{loggingOut ? "Logging out..." : "Log Out"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Add Button - Above bottom nav */}
      <button
        onClick={() => setGroupSelectOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-[10000] w-14 h-14 rounded-full bg-[#10B981] hover:bg-[#10B981]/90 text-white shadow-lg shadow-[#10B981]/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        aria-label="Add expense"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Bottom Navigation - Fixed to viewport with high z-index */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-[#0F172A] border-t border-[#1E293B] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            const active = isActive(tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => {
                  // Scroll to top when tapping active tab (iOS-style behavior)
                  if (active) {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative tap-feedback ${
                  active ? "text-[#10B981]" : "text-slate-400"
                }`}
              >
                {active && (
                  <div className="absolute top-1 w-1 h-1 rounded-full bg-[#10B981]" />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}

          {/* Profile Button */}
          <button
            onClick={() => setProfileMenuOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative ${
              isProfileActive ? "text-[#10B981]" : "text-slate-400"
            }`}
          >
            {isProfileActive && (
              <div className="absolute top-1 w-1 h-1 rounded-full bg-[#10B981]" />
            )}
            <UserCircle className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
}
