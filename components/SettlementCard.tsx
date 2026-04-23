"use client";

import { CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SettlementCardProps {
  settlement: {
    _id: string;
    amount: number;
    method: string;
    note?: string;
    settledAt: string;
    fromUser: {
      name: string;
      avatar?: string;
    };
    toUser: {
      name: string;
      avatar?: string;
    };
  };
}

export function SettlementCard({ settlement }: SettlementCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card className="rounded-3xl border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-300">Payment Settled</p>
              <p className="text-xs text-slate-400">{formatDate(settlement.settledAt)}</p>
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-400">
            {formatCurrency(settlement.amount)}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-300">{settlement.fromUser.name}</span>
          <ArrowRight className="size-4 text-emerald-400" />
          <span className="text-emerald-300">{settlement.toUser.name}</span>
          <span className="text-xs text-slate-500 ml-2 capitalize">({settlement.method})</span>
        </div>

        {settlement.note && (
          <p className="mt-2 text-xs text-slate-500 italic">&ldquo;{settlement.note}&rdquo;</p>
        )}
      </CardContent>
    </Card>
  );
}
