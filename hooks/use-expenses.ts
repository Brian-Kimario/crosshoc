import useSWR from "swr";
import { keys } from "@/lib/swr-keys";
import type { ExpenseCardItem } from "@/components/ExpenseCard";

export interface ExpenseData {
  expenses: ExpenseCardItem[];
  total: number;
  hasMore: boolean;
}

export function useGroupExpenses(groupId: string | null) {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<ExpenseData>(groupId ? keys.expenses(groupId) : null);

  return {
    expenses: data?.expenses ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

export function useMyExpenses(
  page = 1,
  search = "",
  groupId = ""
) {
  const { data, error, isLoading, mutate, isValidating } = useSWR<ExpenseData>(
    keys.myExpenses(page, search, groupId)
  );

  return {
    expenses: data?.expenses ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
