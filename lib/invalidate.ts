import { mutate } from "swr";
import { keys } from "@/lib/swr-keys";

/**
 * Call after any action that changes group financial state.
 * Revalidates all caches that depend on this group.
 */
export async function invalidateGroup(groupId: string) {
  await Promise.all([
    mutate(keys.group(groupId)),
    mutate(keys.expenses(groupId)),
    mutate(keys.balances(groupId)),
    mutate(keys.groupSettlements(groupId)),
    mutate(keys.dashboardOverview()),
    mutate(keys.recentActivity()),
    mutate(keys.settlements("needs-action")),
    mutate(keys.settlementCount()),
  ]);
}

/**
 * Call after expense-only changes (faster — skips balance refetch
 * until navigation forces it).
 */
export async function invalidateExpenses(groupId: string) {
  await Promise.all([
    mutate(keys.expenses(groupId)),
    mutate(keys.recentActivity()),
  ]);
}

/**
 * Call after settlement status changes.
 */
export async function invalidateSettlements(groupId: string) {
  await Promise.all([
    mutate(keys.balances(groupId)),
    mutate(keys.groupSettlements(groupId)),
    mutate(keys.settlements("needs-action")),
    mutate(keys.settlements("pending")),
    mutate(keys.settlements("history")),
    mutate(keys.settlementCount()),
    mutate(keys.dashboardOverview()),
    mutate(keys.recentActivity()),
  ]);
}

/**
 * Call when notifications change.
 */
export async function invalidateNotifications() {
  await Promise.all([
    mutate(keys.notifications()),
    mutate(keys.notificationCount()),
  ]);
}

/**
 * Call after group creation/deletion.
 */
export async function invalidateGroups() {
  await Promise.all([
    mutate(keys.groups()),
    mutate(keys.dashboardOverview()),
  ]);
}
