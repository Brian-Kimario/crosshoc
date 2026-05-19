import useSWR from "swr";
import { keys } from "@/lib/swr-keys";

export interface Settlement {
  _id: string;
  amount: number;
  method: string;
  note?: string;
  proofUrl?: string;
  status: "pending" | "confirmed" | "disputed" | "cancelled" | string;
  settledAt: string;
  createdAt: string;
  confirmedAt?: string;
  disputeReason?: string;
  canCancel: boolean;
  group: { _id: string; name: string; currency: string };
  fromUser: { _id: string; name: string } | null;
  toUser: { _id: string; name: string } | null;
  role: "payer" | "creditor" | "observer";
}

export interface SettlementData {
  settlements: Settlement[];
  total: number;
  hasMore: boolean;
  needsActionCount?: number;
}

export function useSettlements(
  tab: "needs-action" | "pending" | "history" = "needs-action",
  page = 1
) {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<SettlementData>(keys.settlements(tab, page));

  return {
    settlements: data?.settlements ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

export function useNeedsActionCount() {
  const { data, mutate } = useSWR<{ total: number }>(
    keys.settlementCount(),
    { refreshInterval: 30_000 } // poll every 30s
  );
  return {
    count: data?.total ?? 0,
    mutate,
  };
}

export function useGroupSettlements(groupId: string | null) {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<{ settlements: Settlement[] }>(
      groupId ? keys.groupSettlements(groupId) : null
    );

  return {
    settlements: data?.settlements ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
