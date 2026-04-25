import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Wallet, Users, Receipt, CheckCircle } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { verifyAuth } from "@/lib/auth";
import { calculateUserBalances } from "@/lib/balance-server";
import type { UserBalanceSummary } from "@/lib/balance-types";
import { formatCurrency, getBalanceColorClass, getBalanceBgClass } from "@/lib/format-utils";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";

interface GroupData {
  _id: string;
  name: string;
  inviteToken: string;
  members: { user: { name: string; email: string } }[];
  updatedAt: Date;
}

export default async function DashboardPage() {
  const userId = await verifyAuth();
  if (!userId) {
    redirect("/login");
  }

  await dbConnect();

  // Get user balances across all groups
  const balanceSummary = await calculateUserBalances(userId);

  // Get user's groups
  const groups = (await Group.find({ "members.user": userId })
    .populate("members.user", "name email")
    .sort({ updatedAt: -1 })
    .lean()) as unknown as GroupData[];

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Welcome back 👋</h1>
          <p className="text-slate-400 text-lg">
            Stop fighting over bills. Start splitting easier.
          </p>
        </div>

        {/* Balance Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Balance Card */}
          <div
            className={`rounded-3xl border-2 p-6 ${
              balanceSummary.netBalance > 0
                ? "bg-emerald-500/10 border-emerald-500/30"
                : balanceSummary.netBalance < 0
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-slate-500/10 border-slate-500/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Net Balance</p>
                <p
                  className={`text-3xl font-bold ${
                    balanceSummary.netBalance > 0
                      ? "text-emerald-500"
                      : balanceSummary.netBalance < 0
                      ? "text-rose-500"
                      : "text-slate-400"
                  }`}
                >
                  {formatCurrency(Math.abs(balanceSummary.netBalance))}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {balanceSummary.netBalance > 0
                    ? "You are owed money"
                    : balanceSummary.netBalance < 0
                    ? "You owe money"
                    : "All settled up"}
                </p>
              </div>
              <div
                className={`size-12 rounded-2xl flex items-center justify-center ${
                  balanceSummary.netBalance > 0
                    ? "bg-emerald-500/20"
                    : balanceSummary.netBalance < 0
                    ? "bg-rose-500/20"
                    : "bg-emerald-500/20"
                }`}
              >
                {balanceSummary.netBalance === 0 ? (
                  <CheckCircle className="size-6 text-emerald-500" />
                ) : (
                  <Wallet
                    className={`size-6 ${
                      balanceSummary.netBalance > 0
                        ? "text-emerald-500"
                        : "text-rose-500"
                    }`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Owed to Me Card */}
          <div className="rounded-3xl border-2 border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Owed to me</p>
                <p className="text-3xl font-bold text-emerald-500">
                  {formatCurrency(balanceSummary.totalOwedToMe)}
                </p>
                <p className="text-xs text-slate-400 mt-1">From friends</p>
              </div>
              <div className="size-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="size-6 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* I Owe Card */}
          <div className="rounded-3xl border-2 border-rose-500/30 bg-rose-500/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">I owe</p>
                <p className="text-3xl font-bold text-rose-500">
                  {formatCurrency(balanceSummary.totalIOwe)}
                </p>
                <p className="text-xs text-slate-400 mt-1">To friends</p>
              </div>
              <div className="size-12 rounded-2xl bg-rose-500/20 flex items-center justify-center">
                <ArrowDownRight className="size-6 text-rose-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-3xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="size-5 text-emerald-500" />
              <h2 className="text-xl font-semibold text-white">Quick Stats</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">Active Groups</span>
                <span className="font-semibold text-white">{balanceSummary.groupCount}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">People who owe you</span>
                <span
                  className={`font-semibold ${
                    balanceSummary.totalOwedToMe > 0 ? "text-emerald-500" : "text-slate-400"
                  }`}
                >
                  {balanceSummary.totalOwedToMe > 0
                    ? formatCurrency(balanceSummary.totalOwedToMe)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-700">
                <span className="text-slate-400">You owe</span>
                <span
                  className={`font-semibold ${
                    balanceSummary.totalIOwe > 0 ? "text-rose-500" : "text-slate-400"
                  }`}
                >
                  {balanceSummary.totalIOwe > 0 ? formatCurrency(balanceSummary.totalIOwe) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-400">Settlement Status</span>
                <span
                  className={`font-semibold ${
                    balanceSummary.netBalance === 0
                      ? "text-emerald-500"
                      : balanceSummary.netBalance > 0
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}
                >
                  {balanceSummary.netBalance === 0
                    ? "All settled! 🎉"
                    : balanceSummary.netBalance > 0
                    ? "Receiving money"
                    : "Pending payments"}
                </span>
              </div>
            </div>
          </div>
        </div>
    </DashboardShell>
  );
}
