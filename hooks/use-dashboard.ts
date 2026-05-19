import useSWR from "swr";
import { keys } from "@/lib/swr-keys";

export interface DashboardData {
  groups: Array<{
    _id: string;
    name: string;
    description: string;
    members: { _id: string; name: string; email: string }[];
    expenseCount: number;
    myBalance: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
  }>;
  totalOwedToMe: number;
  totalIOwe: number;
}

export function useDashboard() {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<DashboardData>(keys.dashboardOverview(), {
      // Preload related data when dashboard loads
      onSuccess: () => {
        // Preload data the user is likely to need next
        if (typeof window !== "undefined") {
          import("swr").then(({ preload }) => {
            import("@/lib/swr-config").then(({ globalFetcher }) => {
              preload(keys.settlementCount(), globalFetcher);
              preload(keys.recentActivity(), globalFetcher);
              preload(keys.notifications(), globalFetcher);
            });
          });
        }
      },
    });

  return {
    data,
    isLoading,
    isValidating,
    error,
    refresh: mutate,
    groups: data?.groups ?? [],
    totalOwedToMe: data?.totalOwedToMe ?? 0,
    totalIOwe: data?.totalIOwe ?? 0,
  };
}
