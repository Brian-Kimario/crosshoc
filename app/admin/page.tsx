import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import Settlement from "@/lib/models/Settlement";
import Feedback from "@/lib/models/Feedback";
import { formatCurrency } from "@/lib/format-utils";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { AdminRecentActivity } from "@/components/admin/AdminRecentActivity";
import Link from "next/link";
import { Users, AlertTriangle, MessageSquare, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  await dbConnect();

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    newUsers7d,
    totalGroups,
    activeGroups7d,
    totalExpenses,
    expensesToday,
    totalSettlements,
    pendingSettlements,
    disputedSettlements,
    platformVolumeResult,
    unreadFeedback,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: last24h } }),
    User.countDocuments({ createdAt: { $gte: last7d } }),
    Group.countDocuments(),
    Group.countDocuments({ updatedAt: { $gte: last7d } }),
    Expense.countDocuments(),
    Expense.countDocuments({ createdAt: { $gte: last24h } }),
    Settlement.countDocuments(),
    Settlement.countDocuments({ status: "pending" }),
    Settlement.countDocuments({ status: "disputed" }),
    Expense.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Feedback.countDocuments({ read: false }),
  ]);

  const platformVolumeCents =
    platformVolumeResult[0]?.total ?? 0;

  const stats = {
    totalUsers,
    newUsersToday,
    newUsers7d,
    totalGroups,
    activeGroups7d,
    totalExpenses,
    expensesToday,
    totalSettlements,
    pendingSettlements,
    disputedSettlements,
    platformVolumeCents,
    unreadFeedback,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform health at a glance
        </p>
      </div>

      {/* Alerts section — show if anything needs attention */}
      {(disputedSettlements > 0 || pendingSettlements > 5) && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <h3 className="text-sm font-medium text-rose-400">
              ⚠ Needs attention
            </h3>
          </div>
          <div className="space-y-1">
            {disputedSettlements > 0 && (
              <p className="text-sm text-slate-300">
                {disputedSettlements} disputed settlement
                {disputedSettlements !== 1 ? "s" : ""} require review
                {" "}—{" "}
                <Link
                  href="/admin/disputes"
                  className="text-rose-400 hover:underline"
                >
                  View disputes →
                </Link>
              </p>
            )}
            {pendingSettlements > 5 && (
              <p className="text-sm text-slate-300">
                {pendingSettlements} settlements pending
                creditor confirmation
              </p>
            )}
          </div>
        </div>
      )}

      <AdminStatsGrid stats={stats} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          href="/admin/users"
          icon={Users}
          label="Manage Users"
          description="View, promote, disable accounts"
          color="violet"
        />
        <QuickActionCard
          href="/admin/disputes"
          icon={AlertTriangle}
          label="Resolve Disputes"
          description={`${stats.disputedSettlements} pending review`}
          color="rose"
          badge={stats.disputedSettlements > 0 ? stats.disputedSettlements : undefined}
        />
        <QuickActionCard
          href="/admin/feedback"
          icon={MessageSquare}
          label="Review Feedback"
          description={`${stats.unreadFeedback} unread messages`}
          color="teal"
          badge={stats.unreadFeedback > 0 ? stats.unreadFeedback : undefined}
        />
        <QuickActionCard
          href="/admin/health"
          icon={Shield}
          label="System Health"
          description="Monitor performance & status"
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminRecentActivity />
      </div>
    </div>
  );
}

function QuickActionCard({
  href,
  icon: Icon,
  label,
  description,
  color,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: "violet" | "rose" | "teal" | "emerald";
  badge?: number;
}) {
  const colors = {
    violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "hover:border-violet-500/30" },
    rose:    { bg: "bg-rose-500/10",    text: "text-rose-400",    border: "hover:border-rose-500/30" },
    teal:    { bg: "bg-teal-500/10",    text: "text-teal-400",    border: "hover:border-teal-500/30" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "hover:border-emerald-500/30" },
  };
  const c = colors[color];

  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 p-4 bg-[#0F172A] border border-[#1E293B] rounded-xl transition-all hover:bg-[#1E293B]/50 ${c.border}`}
    >
      <div className={`p-2.5 rounded-lg ${c.bg} shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/20 text-rose-400 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}
