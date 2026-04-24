import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { Users, Wallet, ArrowRightLeft, CheckCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import { verifyAuth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { calculateGroupBalances, getSimplifiedDebts } from "@/lib/balance-server";
import { formatCurrency, type SupportedCurrency } from "@/lib/format-utils";
import { ShareGroupDialog } from "./share-group-dialog";
import { SettleUpButton } from "./settle-up-button";
import { PayGuestButton } from "@/components/PayGuestButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { GroupPageContent } from "./group-page-content";

interface MemberUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  avatar?: string | null;
}

interface GroupMember {
  user: MemberUser;
  shareRatio: number;
}

interface GroupDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  inviteToken: string;
  inviteExpiresAt?: Date;
  currency?: string;
  creator: mongoose.Types.ObjectId;
  createdAt: Date;
  members: GroupMember[];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
    .populate("members.user", "name email avatar")
    .lean()) as GroupDoc | null;

  if (!group) notFound();

  const isMember = group.members.some((m) => String(m.user._id) === String(userId));
  if (!isMember) redirect("/");

  const currency = (group.currency || "USD") as SupportedCurrency;

  const balances = await calculateGroupBalances(groupId);
  const simplifiedDebts = await getSimplifiedDebts(balances);

  function getBalanceColorClass(balance: number) {
    if (balance > 0) return "text-emerald-400";
    if (balance < 0) return "text-rose-400";
    return "text-slate-400";
  }

  function getBalanceText(balance: number) {
    if (balance > 0) return `gets back ${formatCurrency(balance, currency)}`;
    if (balance < 0) return `owes ${formatCurrency(Math.abs(balance), currency)}`;
    return (
      <span className="flex items-center gap-1">
        <CheckCircle className="size-3.5" />
        all settled
      </span>
    );
  }

  // Sidebar content for both mobile and desktop
  const sidebarContent = (
    <div className="space-y-6">
      {/* Balance Summary */}
      <Card className="rounded-2xl sm:rounded-3xl border-slate-700 bg-slate-800/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
            <Wallet className="size-5 text-emerald-400" />
            Balance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {balances.map((member) => {
            const isGuestEntry = member.userId.startsWith("guest::");
            return (
              <div
                key={member.userId}
                className={`flex items-center justify-between rounded-xl sm:rounded-2xl border px-3 py-2.5 ${
                  isGuestEntry
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-slate-700 bg-slate-900/60"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar size="sm">
                    {member.avatar ? <AvatarImage src={member.avatar} alt={member.name} /> : null}
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-medium text-sm text-white truncate">
                      {member.name}
                    </p>
                    {isGuestEntry && (
                      <span className="shrink-0 inline-flex items-center rounded border border-emerald-500/50 bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 leading-none">
                        Guest
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${isGuestEntry ? "text-emerald-400" : getBalanceColorClass(member.balance)}`}>
                  {getBalanceText(member.balance)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Simplified Debts */}
      {simplifiedDebts.length > 0 && (
        <Card className="rounded-2xl sm:rounded-3xl border-slate-700 bg-slate-800/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
              <ArrowRightLeft className="size-5 text-emerald-400" />
              Who pays whom
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {simplifiedDebts.map((debt, idx) => {
              const creditorIsGuest = debt.to.startsWith("guest::");
              const rawGuestId = creditorIsGuest ? debt.to.replace("guest::", "") : "";

              return (
                <div
                  key={idx}
                  className="rounded-xl sm:rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-3"
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-sm text-slate-200 font-medium">{debt.fromName}</span>
                    <div className="flex items-center gap-1 text-emerald-400">
                      <span className="text-xs">pays</span>
                      <span className="font-semibold">{formatCurrency(debt.amount, currency)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-emerald-300 font-medium">{debt.toName}</span>
                      {creditorIsGuest && (
                        <span className="inline-flex items-center rounded border border-emerald-500/50 bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 leading-none">
                          Guest
                        </span>
                      )}
                    </div>
                  </div>

                  {creditorIsGuest ? (
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
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="rounded-2xl sm:rounded-3xl border-slate-700 bg-slate-800/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
            <Users className="size-5 text-emerald-400" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {group.members.map((member) => (
            <div
              key={String(member.user._id)}
              className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar size="sm">
                  {member.user.avatar ? (
                    <AvatarImage src={member.user.avatar} alt={member.user.name} />
                  ) : null}
                  <AvatarFallback>{initials(member.user.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-white text-sm truncate">{member.user.name}</p>
                  <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardShell activeGroupId={groupId}>
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-emerald-300 hover:text-emerald-200">
              ← Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ExportCsvButton groupId={groupId} groupName={group.name} />
            <ShareGroupDialog
              groupId={String(group._id)}
              inviteToken={group.inviteToken}
              inviteExpiresAt={group.inviteExpiresAt ? group.inviteExpiresAt.toISOString() : null}
            />
          </div>
        </div>

        <GroupPageContent
          groupId={groupId}
          currency={currency}
          members={group.members.map((m) => ({
            id: String(m.user._id),
            name: m.user.name,
          }))}
          sidebarContent={sidebarContent}
        />
      </div>
    </DashboardShell>
  );
}
