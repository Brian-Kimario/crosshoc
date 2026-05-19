import useSWR from "swr";
import { keys } from "@/lib/swr-keys";

export interface GroupData {
  _id: string;
  name: string;
  description?: string;
  currency: string;
  members: Array<{
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  }>;
  inviteToken: string;
  inviteExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceData {
  userId: string;
  name: string;
  avatar?: string;
  balance: number;
  paid: number;
  owed: number;
}

export interface SimplifiedDebt {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export function useGroup(groupId: string | null) {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<GroupData>(groupId ? keys.group(groupId) : null);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

export function useGroupBalances(groupId: string | null) {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<{
      balances: BalanceData[];
      simplifiedDebts: SimplifiedDebt[];
    }>(groupId ? keys.balances(groupId) : null);

  return {
    balances: data?.balances ?? [],
    simplifiedDebts: data?.simplifiedDebts ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

export function useGroupMembers(groupId: string | null) {
  const { data, error, isLoading, mutate } =
    useSWR<GroupData["members"]>(groupId ? keys.groupMembers(groupId) : null);

  return {
    members: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
