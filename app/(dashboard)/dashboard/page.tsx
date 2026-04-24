"use client";

import { useEffect, useState } from "react";
import { Users, Wallet, TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardShell } from "@/components/dashboard-shell";
import { formatCurrency } from "@/lib/format-utils";

interface BalanceSummary {
  totalOwedToMe: number;
  totalIOwe: number;
  netBalance: number;
  groupCount: number;
}

function BalanceCard({
  title,
  value,
  icon,
  colorClass,
  loading,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
  loading: boolean;
  subtitle: string;
}) {
  return (
    <Card className="border-slate-800 bg-[#1e293b] rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-slate-300">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-28 bg-slate-700 mb-1" />
        ) : (
          <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardHomePage() {
  const [balances, setBalances] = useState<BalanceSummary | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(true);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const res = await fetch("/api/balances/summary", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setBalances(data.data);
      } catch {
        // non-fatal — cards show $0.00
      } finally {
        setLoadingBalances(false);
      }
    };
    fetchBalances();
  }, []);

  return (
    <DashboardShell>
      {({ user, groups }) => (
        <>
          {/* Welcome banner */}
          <section className="rounded-3xl border border-slate-800 bg-[#1a2742] p-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Welcome back, {user.name.split(" ")[0]}!
            </h2>
            <p className="mt-1 text-slate-400 text-sm">
              {user.email}
            </p>
          </section>

          {/* Stats */}
          <section className="grid gap-4 sm:grid-cols-3">
            <BalanceCard
              title="Total Groups"
              value={String(groups.length)}
              icon={<Users className="size-4 text-emerald-300" />}
              colorClass="text-white"
              loading={false}
              subtitle="Groups where you are a member"
            />
            <BalanceCard
              title="Owed To Me"
              value={formatCurrency(balances?.totalOwedToMe ?? 0)}
              icon={<TrendingUp className="size-4 text-emerald-300" />}
              colorClass="text-emerald-300"
              loading={loadingBalances}
              subtitle="Total others owe you across all groups"
            />
            <BalanceCard
              title="I Owe"
              value={formatCurrency(balances?.totalIOwe ?? 0)}
              icon={<TrendingDown className="size-4 text-amber-300" />}
              colorClass="text-amber-300"
              loading={loadingBalances}
              subtitle="Total you owe across all groups"
            />
          </section>

          {/* Groups list */}
          {groups.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Your Groups
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((group) => (
                  <a
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="block rounded-3xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-emerald-500/40 transition-colors p-4"
                  >
                    <p className="font-semibold text-white">{group.name}</p>
                    <p className="text-xs text-slate-400 mt-1">View expenses →</p>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </DashboardShell>
  );
}
