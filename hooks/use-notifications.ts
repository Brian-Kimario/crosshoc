import useSWR from "swr";
import { keys } from "@/lib/swr-keys";

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
  amount?: number;
  currency?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsData {
  data?: {
    notifications: NotificationItem[];
    unreadCount: number;
  };
  notifications?: NotificationItem[];
  count?: number;
}

export function useNotifications() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<NotificationsData>(
    keys.notifications(),
    { refreshInterval: 30_000 } // poll every 30s for badge count
  );

  // Handle both API response formats
  const notifications = data?.data?.notifications ?? data?.notifications ?? [];
  const unreadCount = data?.data?.unreadCount ?? data?.count ?? 0;

  return {
    notifications,
    unreadCount,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

export function useNotificationCount() {
  const { data, mutate } = useSWR<{ count: number }>(
    keys.notificationCount(),
    { refreshInterval: 30_000 }
  );
  return {
    count: data?.count ?? 0,
    mutate,
  };
}
