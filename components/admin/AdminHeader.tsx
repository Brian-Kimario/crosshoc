"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Shield } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/groups": "Groups",
  "/admin/settlements": "Settlements",
  "/admin/disputes": "Disputes",
  "/admin/audit-log": "Audit Log",
  "/admin/invites": "Invite Tokens",
  "/admin/feedback": "Feedback",
  "/admin/health": "System Health",
  "/admin/activity": "Live Activity",
};

export function AdminHeader({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Admin";

  return (
    <header className="h-16 bg-[#0F172A]/80 backdrop-blur-md border-b border-[#1E293B] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-violet-400 lg:hidden" />
        <span className="text-sm text-slate-500">Admin</span>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium text-slate-200">{title}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Link back to the main app */}
        <Link
          href="/dashboard"
          className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-violet-400 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open app
        </Link>

        {/* Mobile user badge */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-violet-400">
              {adminName?.[0]?.toUpperCase() ?? "A"}
            </span>
          </div>
          <span className="text-sm text-slate-300 hidden sm:block">{adminName}</span>
        </div>
      </div>
    </header>
  );
}
