"use client";

import { Users, Wallet, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardHomePage() {
  return (
    <DashboardShell>
      {({ user, groups }) => (
        <>
          <section className="rounded-3xl border border-slate-800 bg-[#1a2742] p-6">
            <h2 className="text-3xl font-bold text-white">Welcome back!</h2>
            <p className="mt-2 text-slate-300">
              Signed in as <span className="text-emerald-300 font-medium">{user.email}</span>
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-800 bg-[#1e293b]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-slate-300">Total Groups</CardTitle>
                <Users className="size-4 text-emerald-300" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">{groups.length}</p>
                <p className="text-xs text-slate-400 mt-1">Groups where you are a member</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#1e293b]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-slate-300">Owed To Me</CardTitle>
                <TrendingUp className="size-4 text-emerald-300" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-300">$0.00</p>
                <p className="text-xs text-slate-400 mt-1">Will update from real balances later</p>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#1e293b]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-slate-300">I Owe</CardTitle>
                <Wallet className="size-4 text-amber-300" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-300">$0.00</p>
                <p className="text-xs text-slate-400 mt-1">Uses dummy values for UI phase</p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </DashboardShell>
  );
}
