import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { Users, Wallet, ArrowRightLeft, CheckCircle, ArrowLeft, Download, Share2 } from "lucide-react";

import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import { verifyAuth } from "@/lib/auth";
import { calculateGroupBalances, getSimplifiedDebts } from "@/lib/balance-server";
import { formatCurrency, formatCurrencyCompact, type SupportedCurrency } from "@/lib/format-utils";
import Settlement from "@/lib/models/Settlement";
import { ShareGroupDialog } from "./share-group-dialog";
import { SettleUpButton } from "./settle-up-button";
import { PayGuestButton } from "@/components/PayGuestButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ExpensesSection } from "./expenses-section";
import { MobileActionBar } from "./MobileActionBar";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { getUserRole, PERMISSION_MATRIX } from "@/lib/group-permissions";
import { RecurringExpensesSection } from "@/components/groups/RecurringExpensesSection";
import { ArchiveGroupButton } from "@/components/groups/ArchiveGroupButton";
import { GroupSettingsPanel } from "@/components/groups/GroupSettingsPanel";

interface MemberUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  avatar?: string | null;
  avatarUrl?: string | null;
}

interface GroupMember {
  user: MemberUser;
  shareRatio: number;
}

interface GroupDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  inviteToken: string;
  inviteExpiresAt?: Date;
  currency?: string;
  creator: mongoose.Types.ObjectId;
  createdAt: Date;
  members: GroupMember[];
  status?: "active" | "archived";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getBalanceColorClass(balance: number) {
  if (balance > 0) return "text-emerald-400";
  if (balance < 0) return "text-rose-400";
  return "text-slate-400";
}

function getBalanceText(balance: number, currency: SupportedCurrency, isCompact = false) {
  const formatter = isCompact ? formatCurrencyCompact : formatCurrency;
  if (balance > 0) return `gets back ${formatter(balance, currency)}`;
  if (balance < 0) return `owes ${formatter(Math.abs(balance), currency)}`;
  return (
    <span className="flex items-center gap-1">
      <CheckCircle className="w-3.5 h-3.5" />
      all settled
    </span>
  );
}

function formatLastActive(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Category icon mapping
function getCategoryIcon(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('food') || desc.includes('dinner') || desc.includes('lunch') || desc.includes('breakfast') || desc.includes('restaurant')) return '🍽️';
  if (desc.includes('cab') || desc.includes('taxi') || desc.includes('uber') || desc.includes('transport') || desc.includes('bus') || desc.includes('train')) return '🚕';
  if (desc.includes('casino') || desc.includes('game') || desc.includes('entertainment') || desc.includes('movie')) return '🎰';
  if (desc.includes('hotel') || desc.includes('accommodation') || desc.includes('airbnb') || desc.includes('stay')) return '🏨';
  if (desc.includes('flight') || desc.includes('plane') || desc.includes('airport')) return '✈️';
  if (desc.includes('groceries') || desc.includes('supermarket') || desc.includes('shopping')) return '🛒';
  if (desc.includes('drink') || desc.includes('bar') || desc.includes('coffee') || desc.includes('cafe')) return '☕';
  return '💰';
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const userId = await verifyAuth();
  if (!userId) redirect("/login");

  const { groupId } = await params;

  if (!mongoose.Types.ObjectId.isValid(groupId)) notFound();

  await dbConnect();
  const group = (await Group.findById(groupId)
    .populate("members.user", "name email avatar avatarUrl")
    .lean()) as GroupDoc | null;

  if (!group) notFound();

  const isMember = group.members.some((m) => String(m.user._id) === String(userId));
  if (!isMember) redirect("/dashboard");

  const currency = (group.currency || "USD") as SupportedCurrency;

  // Fetch balances — wrapped so a drift error never crashes the group page
  let balances: Awaited<ReturnType<typeof calculateGroupBalances>> = [];
  let simplifiedDebts: Awaited<ReturnType<typeof getSimplifiedDebts>> = [];
  try {
    balances = await calculateGroupBalances(groupId);
    simplifiedDebts = await getSimplifiedDebts(balances);
  } catch (err) {
    console.error('[GroupPage] Balance calculation failed:', err);
    // Page still renders — balances and debts will be empty
  }
  const expenseCount = await Expense.countDocuments({ group: groupId });

  // Get real last active date (from last expense or settlement)
  const [lastExpense, lastSettlement] = await Promise.all([
    Expense.findOne({ group: groupId })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean(),
    Settlement.findOne({ group: groupId, status: "confirmed" })
      .sort({ settledAt: -1 })
      .select("settledAt")
      .lean(),
  ]);

  const dates = [
    lastExpense?.createdAt,
    lastSettlement?.settledAt,
    group.createdAt,
  ].filter(Boolean) as Date[];

  const lastActiveAt = new Date(
    Math.max(...dates.map((d) => new Date(d).getTime()))
  ).toISOString();

  const currentUserId = String(userId);

  // getUserRole needs raw ObjectId strings, not populated user objects
  // group.members has populated user objects, so extract the raw member data
  const rawMembers = group.members.map((m) => ({
    user: String(m.user._id),
    role: (m as any).role ?? "owner",
    joinedAt: (m as any).joinedAt ?? new Date(),
  }));
  const userRole = getUserRole(rawMembers as any, currentUserId);
  const canManage = userRole ? PERMISSION_MATRIX[userRole].has("manageRecurring") : false;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header Row - Sticky on mobile for action bar */}
      <div className="sticky top-0 z-20 -mx-4 lg:mx-0 px-4 lg:px-0 py-3 lg:py-0 mb-4 lg:mb-6 bg-[#0A0F1E]/95 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none border-b lg:border-0 border-[#1E293B]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-4">
        {/* Breadcrumb */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 transition-colors mb-1 lg:mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-100">{group.name}</h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <ArchiveGroupButton
            groupId={String(group._id)}
            isArchived={group.status === "archived"}
          />
          <ExportCsvButton groupId={groupId} groupName={group.name} />
          <ShareGroupDialog
            groupId={String(group._id)}
            inviteToken={group.inviteToken}
            inviteExpiresAt={group.inviteExpiresAt ? group.inviteExpiresAt.toISOString() : null}
          />
        </div>
      </div>

      {/* Group Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Members</p>
          <p className="text-sm font-medium text-slate-200">{group.members.length} in group</p>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Expenses</p>
          <p className="text-sm font-medium text-slate-200">{expenseCount} total</p>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Total Spent</p>
          <p className="text-sm font-medium text-slate-200">
            {formatCurrency(balances.reduce((sum, b) => sum + b.paid, 0), currency)}
          </p>
        </div>
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl px-4 py-3">
          <p className="text-xs text-slate-500 mb-1">Last Active</p>
          <p className="text-sm font-medium text-slate-200">
            {formatLastActive(lastActiveAt)}
          </p>
        </div>
      </div>

      {/* Main Grid: Left (feed) + Right (sidebar cards) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left Column - Expense Feed + Mobile Sidebar */}
        <div className="min-w-0 flex flex-col-reverse lg:flex-col">
          {/* Mobile: Sidebar content appears FIRST visually using flex-col-reverse */}
          <div className="lg:hidden mb-6 space-y-6">
            <BalanceSummaryCard balances={balances} currency={currency} currentUserId={currentUserId} />
            <WhoPaysWhomCard debts={simplifiedDebts} currency={currency} groupId={groupId} currentUserId={currentUserId} />
            <MembersCard members={group.members} creatorId={String(group.creator)} />
            <RecurringExpensesSection groupId={groupId} canManage={canManage} currency={currency} />
            <GroupSettingsPanel
              groupId={groupId}
              groupName={group.name}
              groupDescription={(group as any).description ?? ""}
              members={group.members.map((m) => ({
                id: String(m.user._id),
                name: m.user.name,
                email: m.user.email,
                role: (m as any).role ?? "member",
                avatar: m.user.avatarUrl ?? m.user.avatar,
              }))}
              currentUserId={currentUserId}
              currentUserRole={userRole ?? "member"}
            />
          </div>

          <ExpensesSection
            groupId={groupId}
            currency={currency}
            members={group.members.map((m) => ({
              id: String(m.user._id),
              name: m.user.name,
            }))}
            currentUserRole={userRole ?? "member"}
          />
        </div>

        {/* Right Column - Sidebar Cards (Desktop) */}
        <div className="hidden lg:block space-y-6">
          {/* Balance Summary */}
          <BalanceSummaryCard balances={balances} currency={currency} currentUserId={currentUserId} />

          {/* Who Pays Whom */}
          <WhoPaysWhomCard debts={simplifiedDebts} currency={currency} groupId={groupId} currentUserId={currentUserId} />

          {/* Members */}
          <MembersCard members={group.members} creatorId={String(group.creator)} />

          {/* Recurring Expenses */}
          <RecurringExpensesSection groupId={groupId} canManage={canManage} currency={currency} />

          {/* Group Settings */}
          <GroupSettingsPanel
            groupId={groupId}
            groupName={group.name}
            groupDescription={(group as any).description ?? ""}
            members={group.members.map((m) => ({
              id: String(m.user._id),
              name: m.user.name,
              email: m.user.email,
              role: (m as any).role ?? "member",
              avatar: m.user.avatarUrl ?? m.user.avatar,
            }))}
            currentUserId={currentUserId}
            currentUserRole={userRole ?? "member"}
          />
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <MobileActionBar
        currentUserId={currentUserId}
        groupId={groupId}
        currency={currency}
        simplifiedDebts={simplifiedDebts}
      />
    </div>
  );
}

// Balance Summary Card Component
function BalanceSummaryCard({
  balances,
  currency,
  currentUserId,
}: {
  balances: Array<{ userId: string; name: string; avatar?: string; balance: number }>;
  currency: SupportedCurrency;
  currentUserId: string;
}) {
  // Sort: current user first, then by absolute balance amount (largest first)
  const sortedBalances = [...balances].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return Math.abs(b.balance) - Math.abs(a.balance);
  });

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-teal-400" />
        <h3 className="font-semibold text-slate-100">Balance Summary</h3>
      </div>

      <div className="space-y-3">
        {sortedBalances.map((member) => {
          const isGuest = member.userId.startsWith("guest::");
          const isCurrentUser = member.userId === currentUserId;
          const displayName = isCurrentUser ? "You" : member.name;

          return (
            <div
              key={member.userId}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                isCurrentUser
                  ? "bg-[#10B98115] border-l-2 border-l-[#10B981] border-[#1E293B]"
                  : isGuest
                  ? "bg-emerald-950/20 border-emerald-900/30"
                  : "bg-[#1E293B]/50 border-[#1E293B]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={member.name} avatarUrl={member.avatar} size={32} />
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className={`font-medium text-sm truncate ${isCurrentUser ? "text-emerald-300" : "text-slate-200"}`}>
                    {displayName}
                  </p>
                  {isGuest && (
                    <span className="shrink-0 inline-flex items-center rounded border border-teal-500/50 bg-[#1E293B] px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 leading-none">
                      Guest
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-sm font-semibold ${isGuest ? "text-emerald-400" : getBalanceColorClass(member.balance)}`}>
                {getBalanceText(member.balance, currency, true)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Who Pays Whom Card Component
function WhoPaysWhomCard({
  debts,
  currency,
  groupId,
  currentUserId,
}: {
  debts: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }>;
  currency: SupportedCurrency;
  groupId: string;
  currentUserId: string;
}) {
  // Split debts into current user's debts and others' debts
  const myDebts = debts.filter((d) => d.from === currentUserId);
  const otherDebts = debts.filter((d) => d.from !== currentUserId);

  if (debts.length === 0) {
    return (
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-5 h-5 text-teal-400" />
          <h3 className="font-semibold text-slate-100">Who pays whom</h3>
        </div>
        <div className="text-center py-4">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">All settled up!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="w-5 h-5 text-teal-400" />
        <h3 className="font-semibold text-slate-100">Who pays whom</h3>
      </div>

      <div className="space-y-3">
        {/* Current user's debts - with Settle Up buttons */}
        {myDebts.map((debt, idx) => (
          <DebtRow
            key={`my-${idx}`}
            debt={debt}
            currency={currency}
            groupId={groupId}
            isCurrentUser={true}
            currentUserId={currentUserId}
          />
        ))}

        {/* Divider if both sections exist */}
        {myDebts.length > 0 && otherDebts.length > 0 && (
          <div className="pt-2 pb-1">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Others in this group</p>
          </div>
        )}

        {/* Others' debts - read only, no Settle Up buttons */}
        {otherDebts.map((debt, idx) => (
          <DebtRow
            key={`other-${idx}`}
            debt={debt}
            currency={currency}
            groupId={groupId}
            isCurrentUser={false}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

// Individual debt row component
function DebtRow({
  debt,
  currency,
  groupId,
  isCurrentUser,
  currentUserId,
}: {
  debt: { from: string; fromName: string; to: string; toName: string; amount: number };
  currency: SupportedCurrency;
  groupId: string;
  isCurrentUser: boolean;
  currentUserId: string;
}) {
  const creditorIsGuest = debt.to.startsWith("guest::");
  const rawGuestId = creditorIsGuest ? debt.to.replace("guest::", "") : "";
  const isCurrentUserCreditor = debt.to === currentUserId;

  // Personalize names
  const fromDisplay = isCurrentUser ? "You" : debt.fromName;
  const toDisplay = isCurrentUserCreditor ? "you" : debt.toName;

  return (
    <div className={`rounded-xl border px-3 py-3 ${isCurrentUser ? "border-amber-500/30 bg-amber-500/5" : "border-[#1E293B] bg-[#1E293B]/50"}`}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className={`text-sm font-medium ${isCurrentUser ? "text-amber-300" : "text-slate-200"}`}>
          {fromDisplay}
        </span>
        <div className="flex items-center gap-1 text-emerald-400">
          <span className="text-xs">pays</span>
          <span className="font-semibold">{formatCurrencyCompact(debt.amount, currency)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-emerald-300 font-medium">{toDisplay}</span>
          {creditorIsGuest && (
            <span className="inline-flex items-center rounded border border-teal-500/50 bg-[#1E293B] px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 leading-none">
              Guest
            </span>
          )}
        </div>
      </div>

      {/* Settle Up button - ONLY for current user's debts */}
      {isCurrentUser && (
        creditorIsGuest ? (
          <PayGuestButton
            fromUserId={debt.from}
            fromName={debt.fromName}
            guestId={rawGuestId}
            guestName={debt.toName}
            amount={debt.amount}
            groupId={groupId}
            currency={currency}
          />
        ) : (
          <SettleUpButton
            fromUserId={debt.from}
            toUserId={debt.to}
            amount={debt.amount}
            groupId={groupId}
            fromName={debt.fromName}
            toName={debt.toName}
            currency={currency}
          />
        )
      )}
    </div>
  );
}

// Members Card Component
function MembersCard({
  members,
  creatorId,
}: {
  members: GroupMember[];
  creatorId: string;
}) {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-teal-400" />
          <h3 className="font-semibold text-slate-100">Members ({members.length})</h3>
        </div>
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const isCreator = String(member.user._id) === creatorId;
          const isGuest = String(member.user._id).startsWith("guest::");

          return (
            <div
              key={String(member.user._id)}
              className="flex items-center justify-between rounded-xl border border-[#1E293B] bg-[#1E293B]/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={member.user.name} avatarUrl={member.user.avatarUrl ?? member.user.avatar} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-slate-200 text-sm truncate">{member.user.name}</p>
                    {isCreator && <span className="text-[10px] text-teal-400">Owner</span>}
                    {isGuest && (
                      <span className="inline-flex items-center rounded border border-teal-500/50 bg-[#1E293B] px-1.5 py-0.5 text-[10px] font-semibold text-teal-300 leading-none">
                        Guest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{member.user.email || 'No account'}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
