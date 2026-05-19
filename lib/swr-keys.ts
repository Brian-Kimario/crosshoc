/**
 * All SWR cache keys in one place.
 * Using functions ensures consistent key format.
 * Changing a key here invalidates all cached data for that resource.
 */

export const keys = {
  // Dashboard
  dashboardOverview: () => "/api/dashboard/overview" as const,

  // Groups
  groups: () => "/api/groups" as const,
  group: (id: string) => `/api/groups/${id}` as const,
  groupMembers: (id: string) => `/api/groups/${id}/members` as const,

  // Expenses
  expenses: (groupId: string) =>
    `/api/expenses?groupId=${groupId}` as const,
  myExpenses: (page = 1, search = "", groupId = "") => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (search) params.set("search", search);
    if (groupId) params.set("groupId", groupId);
    const qs = params.toString();
    return `/api/expenses/mine${qs ? `?${qs}` : ""}` as const;
  },

  // Balances
  balances: (groupId: string) =>
    `/api/groups/${groupId}/balances` as const,

  // Settlements
  settlements: (tab = "needs-action", page = 1) =>
    `/api/settlements/mine?tab=${tab}&page=${page}` as const,
  settlementCount: () => "/api/settlements/mine?tab=needs-action&countOnly=true" as const,
  groupSettlements: (groupId: string) =>
    `/api/groups/${groupId}/settle` as const,

  // Notifications
  notifications: () => "/api/notifications?limit=20" as const,
  notificationCount: () => "/api/notifications?unreadOnly=true" as const,

  // Activity feed
  recentActivity: () => "/api/activity/recent" as const,

  // User
  profile: () => "/api/user/me" as const,
  notificationPrefs: () => "/api/user/notification-prefs" as const,

  // Invite
  groupInvite: (groupId: string) =>
    `/api/groups/${groupId}/invite` as const,

  // Analytics & Insights
  dashboardInsights: () => "/api/dashboard/insights" as const,
  groupAnalytics: (groupId: string, period: string) =>
    `/api/groups/${groupId}/analytics?period=${period}` as const,
  groupBudget: (groupId: string) =>
    `/api/groups/${groupId}/budget` as const,

  // Archived groups
  archivedGroups: () => "/api/groups?archived=true" as const,

  // Recurring expenses
  groupRecurring: (groupId: string) =>
    `/api/groups/${groupId}/recurring` as const,

  // Expense comments
  expenseComments: (expenseId: string) =>
    `/api/expenses/${expenseId}/comments` as const,

  // Consolidated debts
  consolidatedDebts: () => "/api/user/consolidate-debts" as const,

  // Admin exchange rates
  adminExchangeRates: () => "/api/admin/exchange-rates" as const,
} as const;
