"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Link as LinkIcon,
  Users,
  Receipt,
  Menu,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/lib/store/ui-store";
import { JoinGroupDialog } from "./JoinGroupDialog";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

interface DashboardHeaderProps {
  notificationCount?: number;
  notifications?: unknown[];
}

function getBreadcrumbLabel(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/groups") return "Groups";
  if (pathname === "/expenses") return "Expenses";
  if (pathname === "/settlements") return "Settlements";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/help") return "Help & Support";
  if (pathname === "/feedback") return "Feedback";
  if (pathname.startsWith("/groups/")) return "Group Details";
  if (pathname.startsWith("/invite/")) return "Join Group";
  return "Overview";
}

function MobileActionButton() {
  const [open, setOpen] = useState(false);
  const { setJoinGroupOpen, setCreateGroupOpen } = useUIStore();

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-9 h-9 rounded-xl bg-[#10B981] flex items-center justify-center hover:bg-[#059669] transition-colors"
      >
        <Plus className="w-5 h-5 text-white" />
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm bg-[#0F172A] border-[#1E293B] text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-center">What would you like to do?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <button
              onClick={() => {
                setOpen(false);
                setCreateGroupOpen(true);
              }}
              className="flex items-center gap-4 bg-[#1E293B] border border-[#334155] rounded-2xl p-4 text-left hover:border-[#10B981]/50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Create a group</p>
                <p className="text-xs text-slate-500">Start splitting with friends or family</p>
              </div>
            </button>

            <button
              onClick={() => {
                setOpen(false);
                setJoinGroupOpen(true);
              }}
              className="flex items-center gap-4 bg-[#1E293B] border border-[#334155] rounded-2xl p-4 text-left hover:border-[#10B981]/50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <p className="font-medium text-slate-200">Join a group</p>
                <p className="text-xs text-slate-500">Paste a link or scan a QR code</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardHeader({
  // notificationCount and notifications are kept for backwards compat
  // but ignored — the bell is now self-contained via SSE
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const { joinGroupOpen, setJoinGroupOpen, createGroupOpen, setCreateGroupOpen, setSidebarOpen } = useUIStore();

  const breadcrumbLabel = getBreadcrumbLabel(pathname);

  return (
    <>
      <header className="sticky top-0 z-30 h-15 bg-[#0A0F1E]/80 backdrop-blur-md border-b border-[#1E293B]">
        <div className="h-full flex items-center justify-between px-4 lg:px-6">
          {/* Left - Hamburger (mobile) + Breadcrumb */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2.5 -ml-1 rounded-xl hover:bg-[#1E293B] text-slate-400 hover:text-slate-200 transition-colors min-w-11 min-h-11 flex items-center justify-center shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider hidden sm:inline">
              SplitEasy
            </span>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <span className="text-sm font-medium text-slate-200">
              {breadcrumbLabel}
            </span>
          </div>

          {/* Center - Search (desktop only) */}
          <div className="hidden lg:block">
            <GlobalSearch />
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile: Search icon */}
            <div className="md:hidden">
              <GlobalSearch />
            </div>

            {/* Notification Bell — SSE-connected, self-contained */}
            <NotificationBell />

            {/* Desktop: Join Group + Create Group buttons */}
            <div className="hidden md:flex items-center gap-2">
              <motion.button
                onClick={() => setJoinGroupOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-200 hover:bg-[#1E293B] rounded-lg transition-colors"
              >
                Join a Group
              </motion.button>
              <motion.button
                onClick={() => setCreateGroupOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#10B981] hover:bg-[#059669] text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Group
              </motion.button>
            </div>

            {/* Mobile: Single "+" button */}
            <div className="md:hidden">
              <MobileActionButton />
            </div>
          </div>
        </div>
      </header>


      {/* Dialogs */}
      <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen} />
      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
    </>
  );
}
