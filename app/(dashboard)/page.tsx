import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Sun, Moon, Stars, ArrowRight, Plus, Users } from 'lucide-react';

import { StatCard } from '@/components/dashboard/StatCard';
import { GroupCard } from '@/components/dashboard/GroupCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { verifyAuth } from '@/lib/auth';
import { calculateUserBalances } from '@/lib/balance-server';
import dbConnect from '@/lib/db';
import Group from '@/lib/models/Group';
import Expense from '@/lib/models/Expense';

interface GroupData {
  _id: string;
  name: string;
  members: { user: { _id: string; name: string } }[];
  updatedAt: string;
  expenses?: number;
}

interface GroupBalance {
  groupId: string;
  groupName: string;
  netBalance: number;
  youOwe: number;
  youAreOwed: number;
}

// Time-based greeting helper
function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good morning', icon: <Sun className="w-5 h-5 text-amber-400" /> };
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', icon: <Sun className="w-5 h-5 text-amber-400" /> };
  if (hour >= 17 && hour < 21) return { text: 'Good evening', icon: <Moon className="w-5 h-5 text-violet-400" /> };
  return { text: 'Good night', icon: <Stars className="w-5 h-5 text-violet-400" /> };
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default async function DashboardPage() {
  const userId = await verifyAuth();
  if (!userId) {
    redirect('/login');
  }

  await dbConnect();

  // Get user data — wrapped in try/catch so a balance error never crashes the page
  let balanceSummary = { totalOwedToMe: 0, totalIOwe: 0, netBalance: 0, groupCount: 0 };
  try {
    balanceSummary = await calculateUserBalances(userId);
  } catch (err) {
    console.error('[Dashboard] Balance calculation failed:', err);
    // Page still renders with zero balances
  }

  // Get groups with populated members
  const groups = (await Group.find({ 'members.user': userId })
    .populate('members.user', '_id name')
    .sort({ updatedAt: -1 })
    .lean()) as unknown as GroupData[];

  // Get expense counts for each group
  const groupsWithExpenses = await Promise.all(
    groups.map(async (group) => {
      const expenseCount = await Expense.countDocuments({ group: group._id });
      return { ...group, expenses: expenseCount };
    })
  );

  // Get user name from first group member data or fallback
  const userName =
    groups[0]?.members.find((m) => String(m.user._id) === userId)?.user.name || 'User';

  const greeting = getGreeting();

  // Calculate per-group balances using the balance engine
  const groupBalances: GroupBalance[] = await Promise.all(
    groups.map(async (group) => {
      try {
        const { calculateGroupBalances } = await import('@/lib/balance-server');
        const balances = await calculateGroupBalances(String(group._id));
        const userBalance = balances.find((b) => b.userId === userId);
        const netBalance = userBalance?.balance ?? 0; // integer cents
        return {
          groupId: String(group._id),
          groupName: group.name,
          netBalance,
          youOwe: netBalance < 0 ? Math.abs(netBalance) : 0,
          youAreOwed: netBalance > 0 ? netBalance : 0,
        };
      } catch {
        return { groupId: String(group._id), groupName: group.name, netBalance: 0, youOwe: 0, youAreOwed: 0 };
      }
    })
  );

  // Section C - Activity Feed uses real-time data via DashboardOverview's RecentActivity
  // The ActivityFeed component here is mobile-only (lg:hidden) and receives no server data
  // Real activity is fetched client-side by DashboardOverview via /api/activity/recent

  const totalOwedFormatted = `$${(balanceSummary.totalOwedToMe / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const totalIOweFormatted = `$${(balanceSummary.totalIOwe / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Warn if balance exceeds $99,999 (stored as cents: 9999900)
  const showLargeBalanceWarning = balanceSummary.totalIOwe > 9_999_900;

  return (
    <div className="max-w-7xl mx-auto pb-20 md:pb-0 w-full min-w-0 overflow-x-hidden">
      {/* Section A - Welcome + Financial Summary */}
      <section className="mb-8">
        {/* Greeting */}
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">
            {greeting.text}, {userName}
          </h1>
          {greeting.icon}
        </div>
        <p className="text-sm text-slate-500">{formatDate()}</p>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <StatCard
            type="groups"
            value={balanceSummary.groupCount}
            label="Total groups"
            trend={groups.length > 0 ? `Last joined ${formatDate()}` : undefined}
            groupNames={groups.slice(0, 3).map((g) => g.name)}
            delay={0}
          />
          <StatCard
            type="owed"
            value={balanceSummary.totalOwedToMe === 0 ? 'All settled up ✓' : totalOwedFormatted}
            label="Others owe you"
            subtext={`Across ${balanceSummary.groupCount} group${balanceSummary.groupCount !== 1 ? 's' : ''} · ${
              balanceSummary.totalOwedToMe > 0 ? '2 people' : 'No pending'
            }`}
            delay={0.1}
          />
          <StatCard
            type="owe"
            value={balanceSummary.totalIOwe === 0 ? 'You owe nothing ✓' : totalIOweFormatted}
            label="You owe others"
            subtext={`Across ${balanceSummary.groupCount} group${balanceSummary.groupCount !== 1 ? 's' : ''} · ${
              balanceSummary.totalIOwe > 0 ? '1 person' : 'No pending'
            }`}
            showWarning={showLargeBalanceWarning}
            delay={0.2}
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-8">
        <QuickActions />
      </section>

      {/* Section B - Your Groups */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-widest">
            Your Groups
          </h2>
          <Link
            href="/groups"
            className="text-sm text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {groups.length === 0 ? (
          /* Empty State */
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1E293B] flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">No groups yet</h3>
            <p className="text-sm text-slate-500 mb-6">
              Create one or join via a link to start splitting expenses
            </p>
            <Link href="/groups">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white font-medium rounded-xl transition-colors">
                <Plus className="w-4 h-4" />
                Create your first group
              </button>
            </Link>
          </div>
        ) : (
          /* Groups Grid */
          <div className="grid md:grid-cols-2 gap-4">
            {groupsWithExpenses.map((group, index) => {
              const balance = groupBalances.find((b) => b.groupId === String(group._id));
              const netBalanceCents = balance?.netBalance || 0;
              // Convert cents to display amount for GroupCard
              const netBalanceDisplay = netBalanceCents / 100;

              let balanceType: 'positive' | 'negative' | 'neutral' = 'neutral';
              let balanceLabel = 'settled up';

              if (netBalanceCents > 0) {
                balanceType = 'positive';
                balanceLabel = 'gets back';
              } else if (netBalanceCents < 0) {
                balanceType = 'negative';
                balanceLabel = 'owes';
              }

              return (
                <GroupCard
                  key={group._id}
                  _id={String(group._id)}
                  name={group.name}
                  memberCount={group.members.length}
                  expenseCount={group.expenses || 0}
                  lastActivity={group.updatedAt}
                  balance={{
                    amount: Math.abs(netBalanceDisplay),
                    type: balanceType,
                    label: balanceLabel,
                  }}
                  members={group.members.slice(0, 5).map((m) => ({
                    _id: String(m.user._id),
                    name: m.user.name,
                    initials: getInitials(m.user.name),
                    color: '',
                  }))}
                  colorIndex={index}
                  delay={index * 0.1}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Section C - Activity Feed (3rd column on desktop) */}
      <section className="lg:hidden">
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4">
          Recent Activity
        </h2>
        <ActivityFeed activities={[]} />
      </section>
    </div>
  );
}
