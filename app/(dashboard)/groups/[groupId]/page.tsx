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
import { formatCurrency } from "@/lib/format-utils";
import { ShareGroupDialog } from "./share-group-dialog";
import { ExpensesSection } from "./expenses-section";
import { SettleUpButton } from "./settle-up-button";

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
  if (!userId) {
    redirect("/login");
  }

  const { groupId } = await params;
  console.log("Fetching Group ID:", groupId);

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    notFound();
  }

  await dbConnect();
  const group = (await Group.findById(groupId)
    .populate("members.user", "name email avatar")
    .lean()) as GroupDoc | null;

  if (!group) {
    notFound();
  }

  const isMember = group.members.some((member) => String(member.user._id) === String(userId));
  if (!isMember) {
    redirect("/");
  }

  // Calculate balances
  const balances = await calculateGroupBalances(groupId);
  const simplifiedDebts = await getSimplifiedDebts(balances);

  function getBalanceColorClass(balance: number) {
    if (balance > 0) return "text-emerald-400";
    if (balance < 0) return "text-rose-400";
    return "text-slate-400";
  }

  function getBalanceText(balance: number) {
    if (balance > 0) return `gets back ${formatCurrency(balance)}`;
    if (balance < 0) return `owes ${formatCurrency(Math.abs(balance))}`;
    return (
      <span className="flex items-center gap-1">
        <CheckCircle className="size-3.5" />
        all settled
      </span>
    );
  }

  return (
    <DashboardShell activeGroupId={groupId}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-emerald-300 hover:text-emerald-200">
              ← Back to Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-bold">{group.name}</h1>
          </div>
          <ShareGroupDialog inviteToken={group.inviteToken} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[7fr_3fr]">
          <ExpensesSection
            groupId={groupId}
            members={group.members.map((member) => ({
              id: String(member.user._id),
              name: member.user.name,
            }))}
          />

          <div className="space-y-6">
            {/* Balance Summary Card */}
            <Card className="rounded-3xl border-slate-700 bg-slate-800/80">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wallet className="size-5 text-emerald-300" />
                  Balance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {balances.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar size="sm">
                        {member.avatar ? <AvatarImage src={member.avatar} alt={member.name} /> : null}
                        <AvatarFallback>{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <p className="font-medium text-white text-sm truncate">{member.name}</p>
                    </div>
                    <span className={`text-sm font-medium ${getBalanceColorClass(member.balance)}`}>
                      {getBalanceText(member.balance)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Simplified Debts Card */}
            {simplifiedDebts.length > 0 && (
              <Card className="rounded-3xl border-slate-700 bg-slate-800/80">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ArrowRightLeft className="size-5 text-emerald-300" />
                    Who pays whom
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {simplifiedDebts.map((debt, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">{debt.fromName}</span>
                        <div className="flex items-center gap-1 text-emerald-400">
                          <span className="text-xs">pays</span>
                          <span className="font-medium">{formatCurrency(debt.amount)}</span>
                        </div>
                        <span className="text-sm text-emerald-300">{debt.toName}</span>
                      </div>
                      <SettleUpButton
                        fromUserId={debt.from}
                        toUserId={debt.to}
                        amount={debt.amount}
                        groupId={groupId}
                        fromName={debt.fromName}
                        toName={debt.toName}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Members Card */}
            <Card className="rounded-3xl border-slate-700 bg-slate-800/80">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="size-5 text-emerald-300" />
                  Members
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.members.map((member) => (
                  <div
                    key={String(member.user._id)}
                    className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar size="sm">
                        {member.user.avatar ? <AvatarImage src={member.user.avatar} alt={member.user.name} /> : null}
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
        </div>
      </div>
    </DashboardShell>
  );
}
