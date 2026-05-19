"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Receipt,
  CheckCircle,
  Settings,
  HelpCircle,
  MessageSquare,
  Plus,
  ChevronDown,
  LogOut,
  MoreVertical,
} from "lucide-react";
import { useUIStore } from "@/lib/store/ui-store";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Group {
  _id: string;
  name: string;
  color?: string;
}

interface User {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface DashboardSidebarProps {
  user: User;
  groups: Group[];
}

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Users, label: "Groups", href: "/groups" },
  { icon: Receipt, label: "Expenses", href: "/expenses" },
  { icon: CheckCircle, label: "Settlements", href: "/settlements" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const groupColors = [
  "bg-teal-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
];

export function DashboardSidebar({ user, groups }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Signed out successfully");
        router.push("/login");
        router.refresh();
      } else {
        toast.error("Failed to sign out");
        setSigningOut(false);
      }
    } catch {
      toast.error("An error occurred");
      setSigningOut(false);
    }
  };

  const displayGroups = groups.slice(0, 5);
  const hasMoreGroups = groups.length > 5;

  return (
    <aside className="hidden md:flex w-60 min-h-screen flex-col fixed left-0 top-0 bg-[#0B1120] border-r border-[#1E293B] z-40">
      {/* Logo */}
      <div className="p-4 border-b border-[#1E293B]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="font-semibold text-slate-100">SplitEasy</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Menu Label */}
        <div className="px-3 mb-2">
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
            Menu
          </span>
        </div>

        {/* Nav Items */}
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? "text-emerald-400 bg-[#10B98115] border-l-2 border-[#10B981]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}

        {/* Groups Section */}
        {groups.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="w-full flex items-center justify-between px-3 mb-2 text-xs font-medium text-slate-600 uppercase tracking-wider hover:text-slate-500 transition-colors"
            >
              <span>Your Groups</span>
              <motion.div
                animate={{ rotate: groupsExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.div>
            </button>

            <AnimatePresence>
              {groupsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1 overflow-hidden"
                >
                  {displayGroups.map((group, index) => {
                    const isActive = pathname.includes(`/groups/${group._id}`);
                    const colorClass = groupColors[index % groupColors.length];

                    return (
                      <Link key={group._id} href={`/groups/${group._id}`}>
                        <motion.div
                          whileHover={{ x: 2 }}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? "text-slate-200 bg-[#1E293B]/50"
                              : "text-slate-500 hover:text-slate-300 hover:bg-[#1E293B]/30"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                          <span className="truncate">{group.name}</span>
                        </motion.div>
                      </Link>
                    );
                  })}

                  {hasMoreGroups && (
                    <Link href="/groups">
                      <div className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:text-teal-400 transition-colors">
                        <span>+ {groups.length - 5} more →</span>
                      </div>
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
            onClick={() => useUIStore.getState().setCreateGroupOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 mt-1 text-sm text-slate-600 hover:text-teal-400 hover:bg-[#1E293B] rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New group</span>
          </button>
          </div>
        )}

        {/* Support Section */}
        <div className="mt-6">
          <div className="px-3 mb-2">
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              Support
            </span>
          </div>

          <Link href="/help">
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-all"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help & Support</span>
            </motion.div>
          </Link>

          <Link href="/feedback">
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Feedback</span>
            </motion.div>
          </Link>
        </div>
      </nav>

      {/* User Card */}
      <div className="p-3 border-t border-[#1E293B]">
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 p-3 bg-[#1E293B] border border-[#334155] rounded-xl hover:border-[#475569] transition-all"
          >
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={32} />
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-[#1E293B] border border-[#334155] rounded-xl p-2 shadow-xl"
              >
                <div className="h-px bg-[#334155] my-1 hidden" />
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{signingOut ? "Signing out..." : "Sign out"}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
