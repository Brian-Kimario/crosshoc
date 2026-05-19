"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FolderOpen,
  ArrowLeftRight, FileText, AlertTriangle,
  Link2, MessageSquare, Activity, Shield,
  DollarSign,
} from "lucide-react";

const NAV: {
  label: string;
  items: {
    href: string;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badgeKey?: string;
  }[];
}[] = [
  {
    label: "OVERVIEW",
    items: [
      { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
      { href: "/admin/activity", label: "Live Activity", Icon: Activity },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { href: "/admin/users", label: "Users", Icon: Users },
      { href: "/admin/groups", label: "Groups", Icon: FolderOpen },
      { href: "/admin/settlements", label: "Settlements", Icon: ArrowLeftRight },
      { href: "/admin/disputes", label: "Disputes", Icon: AlertTriangle },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/admin/audit-log", label: "Audit Log", Icon: FileText },
      { href: "/admin/invites", label: "Invite Tokens", Icon: Link2 },
      { href: "/admin/feedback", label: "Feedback", Icon: MessageSquare, badgeKey: "feedback" },
      { href: "/admin/health", label: "System Health", Icon: Activity },
      { href: "/admin/exchange-rates", label: "Exchange Rates", Icon: DollarSign },
    ],
  },
];

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number>>({});

  // Fetch notification counts
  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch("/api/admin/feedback?unread=true");
        if (res.ok) {
          const data = await res.json();
          setBadges({ feedback: data.unreadCount ?? 0 });
        }
      } catch {
        // Silently fail
      }
    }
    fetchBadges();
    const interval = setInterval(fetchBadges, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 bg-[#0F172A] border-r border-[#1E293B] fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#1E293B]">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-200">Admin</h1>
            <p className="text-xs text-slate-500">SplitEasy</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map(({ href, label, Icon, exact, badgeKey }) => {
                  const active = isActive(href, exact);
                  const badge = badgeKey ? badges[badgeKey] : 0;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-violet-500/10 text-violet-400"
                            : "text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/50"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="font-medium">{label}</span>
                        </span>
                        {badge > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/20 text-rose-400 rounded-full">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Admin badge */}
        <div className="p-4 border-t border-[#1E293B]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1E293B]/50">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-violet-400">
                {adminName?.[0]?.toUpperCase() ?? "A"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">
                {adminName}
              </p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar - placeholder for mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F172A] border-t border-[#1E293B] px-4 py-2">
        <nav className="flex items-center justify-around">
          {NAV.flatMap(s => s.items).slice(0, 5).map(({ href, label, Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg ${
                  active ? "text-violet-400" : "text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
