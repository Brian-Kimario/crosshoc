# Requirements Document

## Introduction

Phase 11 of SplitEasy adds Group Analytics, Spending Insights, and Charts. The feature gives users visibility into how money is being spent within groups and across the dashboard. It introduces per-group budget tracking with threshold alerts, a dedicated Analytics tab on the group detail page, and a cross-group spending insights panel on the dashboard. All monetary values are stored as integer cents and displayed via `formatMoney`. Charts are rendered with Recharts and must be fully functional on mobile with touch interactions.

## Glossary

- **Analytics_API**: The server-side route at `/api/groups/[id]/analytics` that computes and returns group-level spending statistics.
- **Insights_API**: The server-side route at `/api/dashboard/insights` that computes and returns cross-group spending statistics for the authenticated user.
- **Budget_API**: The server-side route at `/api/groups/[id]/budget` that manages the budget sub-document on a Group.
- **Budget_Alert_Cron**: The scheduled job at `/api/cron/budget-alerts` that checks budget utilization and sends threshold notifications.
- **Analytics_Panel**: The `GroupAnalyticsPanel` client component rendered inside the Analytics tab of the group detail page.
- **Dashboard_Insights**: The `DashboardInsights` client component rendered on the dashboard between the stat cards and the groups grid.
- **Budget_Card**: The `BudgetCard` client component that displays budget status and provides set/edit/delete actions.
- **CategoryDonutChart**: A Recharts Pie/donut chart component that visualises category spending breakdown.
- **SpendingTimelineChart**: A Recharts Bar chart component that visualises weekly spending over time.
- **DailyTrendChart**: A Recharts Area chart component that visualises daily spending over the last 30 days.
- **MemberContributionChart**: A Recharts horizontal Bar chart component that visualises per-member paid vs owed amounts.
- **Chart_Theme**: The `lib/chart-theme.ts` module that exports shared color constants and tooltip styles for all chart components.
- **Period**: A query parameter controlling the time window for analytics: `7d`, `30d`, `90d`, or `all`.
- **ISO_Week**: A calendar week identifier in the format `YYYY-Www` (e.g. `2024-W03`) used as the key for timeline data points.
- **Budget**: A sub-document on the Group model with fields: `limitCents` (integer), `currency` (string), `period` (`monthly` | `per-trip` | `total`), `alertAt` (integer percentage, default 80), `alertSentAt` (Date or null), `createdAt` (Date).
- **Cents**: Integer representation of a monetary amount. $1.00 = 100 cents.
- **formatMoney**: The existing utility in `lib/money.ts` that converts integer cents to a display string. Must not be modified.
- **formatCurrencyCompact**: A new utility that abbreviates large amounts: ≥ $1 M → `$1.4M`, ≥ $10 K → `$14.4K`, otherwise falls back to `formatMoney`.
- **SWR**: The data-fetching library already used in the project for client-side caching.
- **Recharts**: The charting library to be installed via `pnpm add recharts`.
- **Zod**: The validation library already used in the project for API input validation.
- **x-cron-secret**: An HTTP request header used to authenticate calls to cron job endpoints.

---

## Requirements

### Requirement 1: Recharts Dependency

**User Story:** As a developer, I want Recharts available in the project, so that I can render interactive charts without introducing a conflicting charting library.

#### Acceptance Criteria

1. THE System SHALL include `recharts` as a production dependency in `package.json`.
2. WHEN `recharts` is already present in `package.json`, THE System SHALL not add a duplicate entry.

---

### Requirement 2: Chart Theme Module

**User Story:** As a developer, I want a single source of truth for chart colors and tooltip styles, so that all chart components share a consistent dark-theme visual language.

#### Acceptance Criteria

1. THE Chart_Theme SHALL export a `CHART_COLORS` array of at least six hex color strings suitable for a dark background.
2. THE Chart_Theme SHALL export a `CATEGORY_COLORS` record mapping each expense category string to a hex color string.
3. THE Chart_Theme SHALL export a `CATEGORY_LABELS` record mapping each expense category string to a human-readable label string.
4. THE Chart_Theme SHALL export a `tooltipStyle` object containing CSS-in-JS properties for a dark-themed Recharts tooltip.
5. WHEN a category is not present in `CATEGORY_COLORS`, THE Chart_Theme SHALL provide a fallback color value.

---

### Requirement 3: Group Analytics API

**User Story:** As a group member, I want the server to compute spending statistics for my group, so that the Analytics tab can display accurate charts and summaries.

#### Acceptance Criteria

1. WHEN an authenticated user sends a `GET` request to `/api/groups/[id]/analytics`, THE Analytics_API SHALL return HTTP 200 with a JSON body containing: `period`, `currency`, `totalSpentCents`, `totalExpenses`, `avgExpenseCents`, `largestExpense` (with `description` and `amountCents`), `categoryBreakdown` (array of `{ category, totalCents, percentage }`), `timeline` (array of `{ week, totalCents }` keyed by ISO week), `memberBreakdown` (array of `{ userId, name, paidCents, owedCents }`), and `budgetUtilization` (object with `limitCents`, `spentCents`, `usedPercent`, `remainingCents`, `isOverBudget`, or `null` when no budget is set).
2. WHEN the `period` query parameter is `7d`, THE Analytics_API SHALL include only expenses created within the last 7 days.
3. WHEN the `period` query parameter is `30d`, THE Analytics_API SHALL include only expenses created within the last 30 days.
4. WHEN the `period` query parameter is `90d`, THE Analytics_API SHALL include only expenses created within the last 90 days.
5. WHEN the `period` query parameter is `all` or is absent, THE Analytics_API SHALL include all non-voided expenses for the group.
6. WHEN the requesting user is not a member of the group, THE Analytics_API SHALL return HTTP 403.
7. WHEN the group ID is not a valid MongoDB ObjectId, THE Analytics_API SHALL return HTTP 400.
8. WHEN the group does not exist, THE Analytics_API SHALL return HTTP 404.
9. IF the user is not authenticated, THEN THE Analytics_API SHALL return HTTP 401.
10. THE Analytics_API SHALL exclude voided expenses (`isVoided: true`) from all calculations.
11. WHEN the group has no expenses in the selected period, THE Analytics_API SHALL return `totalSpentCents: 0`, `totalExpenses: 0`, `avgExpenseCents: 0`, `largestExpense: null`, empty arrays for `categoryBreakdown`, `timeline`, and `memberBreakdown`.
12. THE Analytics_API SHALL compute `categoryBreakdown` percentages such that the sum of all `percentage` values equals 100 for any non-empty expense set.

---

### Requirement 4: Dashboard Insights API

**User Story:** As a user, I want the server to compute cross-group spending statistics, so that the dashboard can show me a monthly overview and trends.

#### Acceptance Criteria

1. WHEN an authenticated user sends a `GET` request to `/api/dashboard/insights`, THE Insights_API SHALL return HTTP 200 with a JSON body containing: `thisMonthTotalCents`, `lastMonthTotalCents`, `monthChangePercent`, `topCategories` (top 5 categories by total cents, each with `category` and `totalCents`), `dailyTrend` (array of `{ date, totalCents }` for each of the last 30 calendar days, with zero-filled entries for days with no expenses), and `groupSpending` (array of `{ groupId, groupName, spentCents, currency }` for all groups the user belongs to).
2. THE Insights_API SHALL include only expenses where the authenticated user is a member of the group.
3. THE Insights_API SHALL exclude voided expenses from all calculations.
4. WHEN `dailyTrend` is computed, THE Insights_API SHALL include an entry for every calendar day in the last 30 days, using `totalCents: 0` for days with no expenses.
5. IF the user is not authenticated, THEN THE Insights_API SHALL return HTTP 401.
6. WHEN `lastMonthTotalCents` is zero, THE Insights_API SHALL return `monthChangePercent: null` to avoid division by zero.

---

### Requirement 5: Budget Schema Extension

**User Story:** As a developer, I want the Group model to store budget configuration, so that budget tracking and alerts can be persisted per group.

#### Acceptance Criteria

1. THE Group model SHALL include an optional `budget` sub-document with fields: `limitCents` (positive integer), `currency` (string), `period` (enum: `monthly`, `per-trip`, `total`), `alertAt` (integer between 50 and 100, default 80), `alertSentAt` (Date, nullable), `createdAt` (Date).
2. WHEN a group has no budget configured, THE Group model SHALL store `budget` as `undefined` or `null`.
3. THE Group model SHALL not require `budget` to be present for existing groups (backward-compatible schema change).

---

### Requirement 6: Budget Management API

**User Story:** As a group member, I want to set, update, and remove a spending budget for my group, so that I can track whether the group is on track financially.

#### Acceptance Criteria

1. WHEN an authenticated group member sends a `PUT` request to `/api/groups/[id]/budget` with a valid body, THE Budget_API SHALL persist the budget sub-document on the group and return HTTP 200 with the updated budget object.
2. THE Budget_API SHALL validate the `PUT` request body using Zod with the following rules: `limitCents` must be an integer ≥ 1; `period` must be one of `monthly`, `per-trip`, `total`; `alertAt` must be an integer between 50 and 100 inclusive.
3. WHEN the `PUT` request body fails Zod validation, THE Budget_API SHALL return HTTP 422 with a JSON body describing the validation errors.
4. WHEN an authenticated group member sends a `DELETE` request to `/api/groups/[id]/budget`, THE Budget_API SHALL remove the budget sub-document from the group and return HTTP 200.
5. WHEN a budget is set or updated via `PUT`, THE Budget_API SHALL reset `alertSentAt` to `null` on the budget sub-document.
6. WHEN the requesting user is not a member of the group, THE Budget_API SHALL return HTTP 403.
7. IF the user is not authenticated, THEN THE Budget_API SHALL return HTTP 401.
8. WHEN the group ID is not a valid MongoDB ObjectId, THE Budget_API SHALL return HTTP 400.

---

### Requirement 7: CategoryDonutChart Component

**User Story:** As a user, I want to see a donut chart of spending by category, so that I can quickly understand where money is going in a group.

#### Acceptance Criteria

1. THE CategoryDonutChart SHALL render a Recharts Pie chart in donut style using colors from `Chart_Theme`.
2. THE CategoryDonutChart SHALL display a custom tooltip showing the category label and formatted amount when a segment is hovered or tapped.
3. THE CategoryDonutChart SHALL render a legend below the chart listing each category with its color dot and label.
4. THE CategoryDonutChart SHALL accept a `size` prop with values `sm`, `md`, or `lg` that controls the chart dimensions.
5. WHEN the `categoryBreakdown` data array is empty, THE CategoryDonutChart SHALL render an empty-state message instead of the chart.
6. THE CategoryDonutChart SHALL be interactive on mobile touch devices.

---

### Requirement 8: SpendingTimelineChart Component

**User Story:** As a user, I want to see a bar chart of weekly spending, so that I can identify high-spend weeks within a group.

#### Acceptance Criteria

1. THE SpendingTimelineChart SHALL render a Recharts Bar chart with one bar per ISO week.
2. THE SpendingTimelineChart SHALL display a custom tooltip showing the ISO week label and the formatted amount using `formatMoney`.
3. THE SpendingTimelineChart SHALL render compact Y-axis labels using `formatCurrencyCompact`.
4. WHEN the `timeline` data array is empty, THE SpendingTimelineChart SHALL render an empty-state message instead of the chart.
5. THE SpendingTimelineChart SHALL be interactive on mobile touch devices.

---

### Requirement 9: DailyTrendChart Component

**User Story:** As a user, I want to see an area chart of daily spending over the last 30 days on the dashboard, so that I can spot spending patterns at a glance.

#### Acceptance Criteria

1. THE DailyTrendChart SHALL render a Recharts Area chart with one data point per calendar day.
2. THE DailyTrendChart SHALL accept a `height` prop (number) that controls the chart height in pixels.
3. THE DailyTrendChart SHALL render compact Y-axis labels using `formatCurrencyCompact`.
4. WHEN all `totalCents` values in the data are zero, THE DailyTrendChart SHALL render an empty-state message instead of the chart.
5. THE DailyTrendChart SHALL be interactive on mobile touch devices.

---

### Requirement 10: MemberContributionChart Component

**User Story:** As a user, I want to see a horizontal bar chart comparing how much each member paid versus owed, so that I can understand individual contributions within a group.

#### Acceptance Criteria

1. THE MemberContributionChart SHALL render a Recharts horizontal Bar chart with two bars per member: one for `paidCents` and one for `owedCents`.
2. THE MemberContributionChart SHALL display at most 8 members, ordered by total paid amount descending.
3. THE MemberContributionChart SHALL visually highlight the bar row belonging to the currently authenticated user.
4. THE MemberContributionChart SHALL display a custom tooltip showing the member name, paid amount, and owed amount using `formatMoney`.
5. WHEN the `memberBreakdown` data array is empty, THE MemberContributionChart SHALL render an empty-state message instead of the chart.
6. THE MemberContributionChart SHALL be interactive on mobile touch devices.

---

### Requirement 11: Group Analytics Tab

**User Story:** As a group member, I want a dedicated Analytics tab on the group detail page, so that I can switch between the expense list and spending analytics without leaving the page.

#### Acceptance Criteria

1. THE System SHALL add a tab bar to the group detail page with two tabs: "Expenses" (default active) and "Analytics".
2. WHEN the "Expenses" tab is active, THE System SHALL render the existing expense feed content.
3. WHEN the "Analytics" tab is active, THE System SHALL render the Analytics_Panel component.
4. THE System SHALL use Lucide React icons to label the tabs.
5. THE System SHALL preserve all existing group detail page functionality when the "Expenses" tab is active.

---

### Requirement 12: Group Analytics Panel

**User Story:** As a group member, I want the Analytics tab to show a comprehensive spending overview, so that I can understand group finances at a glance.

#### Acceptance Criteria

1. THE Analytics_Panel SHALL fetch data from the Analytics_API using SWR with the selected period as a query parameter.
2. THE Analytics_Panel SHALL render a period selector with options: `7d`, `30d`, `90d`, `all`.
3. THE Analytics_Panel SHALL render four summary stat cards: total spent, number of expenses, average expense, and largest expense.
4. THE Analytics_Panel SHALL render the Budget_Card component.
5. THE Analytics_Panel SHALL render the CategoryDonutChart and SpendingTimelineChart in a two-column layout on desktop and stacked on mobile.
6. THE Analytics_Panel SHALL render the MemberContributionChart.
7. THE Analytics_Panel SHALL render a callout card highlighting the largest expense description and amount.
8. WHEN the Analytics_API is loading, THE Analytics_Panel SHALL render skeleton placeholders for all sections.
9. WHEN the Analytics_API returns an error, THE Analytics_Panel SHALL render an error message with a retry option.
10. WHEN the selected period changes, THE Analytics_Panel SHALL re-fetch data from the Analytics_API with the new period value.

---

### Requirement 13: Budget Card Component

**User Story:** As a group member, I want a budget card that shows current spending against the budget limit, so that I can monitor whether the group is within budget.

#### Acceptance Criteria

1. WHEN no budget is set for the group, THE Budget_Card SHALL render a dashed "Set a budget" button.
2. WHEN the "Set a budget" button is activated, THE Budget_Card SHALL display an inline form with: a limit input (entered in the group's display currency, stored as integer cents), a period selector (`monthly`, `per-trip`, `total`), and save/cancel actions.
3. WHEN a budget is set, THE Budget_Card SHALL render a progress bar showing `spentCents / limitCents` as a percentage.
4. WHEN a budget is set, THE Budget_Card SHALL display the spent amount, remaining amount, and limit amount using `formatMoney`.
5. WHEN `usedPercent` is less than 80, THE Budget_Card SHALL render the progress bar in green.
6. WHEN `usedPercent` is between 80 and 99 inclusive, THE Budget_Card SHALL render the progress bar in amber.
7. WHEN `usedPercent` is 100 or greater, THE Budget_Card SHALL render the progress bar in rose and display an "Over budget" badge.
8. WHEN a budget is set, THE Budget_Card SHALL provide edit and delete action buttons.
9. WHEN the delete action is confirmed, THE Budget_Card SHALL call the `DELETE /api/groups/[id]/budget` endpoint and update the UI optimistically.
10. WHEN the save action is submitted, THE Budget_Card SHALL call the `PUT /api/groups/[id]/budget` endpoint with `limitCents` converted from the user-entered dollar amount.
11. WHEN the save action fails validation, THE Budget_Card SHALL display inline field-level error messages.

---

### Requirement 14: Dashboard Insights Component

**User Story:** As a user, I want to see a spending insights panel on my dashboard, so that I can understand my overall spending trends without navigating to individual groups.

#### Acceptance Criteria

1. THE Dashboard_Insights SHALL fetch data from the Insights_API using SWR.
2. WHEN `thisMonthTotalCents` is zero, THE Dashboard_Insights SHALL not render (the component returns null).
3. THE Dashboard_Insights SHALL display the total spent this month using `formatMoney`.
4. THE Dashboard_Insights SHALL display a trend indicator icon and the `monthChangePercent` value comparing this month to last month.
5. WHEN `monthChangePercent` is positive, THE Dashboard_Insights SHALL render the trend indicator in rose (spending increased).
6. WHEN `monthChangePercent` is negative or zero, THE Dashboard_Insights SHALL render the trend indicator in emerald (spending decreased or unchanged).
7. THE Dashboard_Insights SHALL render the DailyTrendChart for the last 30 days.
8. THE Dashboard_Insights SHALL render the top categories list with a color dot per category using `CATEGORY_COLORS` from Chart_Theme.
9. THE Dashboard_Insights SHALL render a per-group spending breakdown showing each group's name and `spentCents` using `formatMoney`.
10. THE System SHALL render the Dashboard_Insights component between the stat cards and the groups grid in `DashboardOverview`.

---

### Requirement 15: formatCurrencyCompact Utility

**User Story:** As a developer, I want a compact currency formatter, so that large amounts display legibly on chart axes without overflowing.

#### Acceptance Criteria

1. THE formatCurrencyCompact SHALL be defined in `lib/format-utils.ts` (it already exists there; this requirement confirms the spec-level contract).
2. WHEN the display amount is ≥ $1,000,000, THE formatCurrencyCompact SHALL return a string in the format `{symbol}{value}M` where `value` is rounded to one decimal place (e.g. `$1.4M`).
3. WHEN the display amount is ≥ $10,000 and < $1,000,000, THE formatCurrencyCompact SHALL return a string in the format `{symbol}{value}K` where `value` is rounded to one decimal place (e.g. `$14.4K`).
4. WHEN the display amount is < $10,000, THE formatCurrencyCompact SHALL return the result of `formatMoney` for the same amount.
5. THE formatCurrencyCompact SHALL accept amounts in integer cents and convert to display units before applying thresholds.
6. FOR ALL valid cent amounts, parsing the numeric portion of `formatCurrencyCompact` output SHALL produce a value within 0.1% of the original display amount (round-trip approximation property).

---

### Requirement 16: SWR Keys Extension

**User Story:** As a developer, I want all SWR cache keys defined in one place, so that key changes propagate consistently across the codebase.

#### Acceptance Criteria

1. THE System SHALL add a `dashboardInsights` key function to `lib/swr-keys.ts` that returns the string `"/api/dashboard/insights"`.
2. THE System SHALL add a `groupAnalytics` key function to `lib/swr-keys.ts` that accepts a `groupId` string and a `period` string and returns the string `/api/groups/${groupId}/analytics?period=${period}`.
3. THE System SHALL add a `groupBudget` key function to `lib/swr-keys.ts` that accepts a `groupId` string and returns the string `/api/groups/${groupId}/budget`.

---

### Requirement 17: Budget Alert Cron Job

**User Story:** As a group member, I want to receive a notification when my group's spending reaches the configured alert threshold, so that I can take action before exceeding the budget.

#### Acceptance Criteria

1. WHEN the Budget_Alert_Cron receives a `GET` request with a valid `x-cron-secret` header matching the `CRON_SECRET` environment variable, THE Budget_Alert_Cron SHALL process all groups that have a budget set and `alertSentAt` equal to `null`.
2. WHEN the `x-cron-secret` header is missing or does not match `CRON_SECRET`, THE Budget_Alert_Cron SHALL return HTTP 401.
3. FOR each qualifying group, THE Budget_Alert_Cron SHALL compute current spending using `Expense.aggregate` excluding voided expenses.
4. WHEN the computed spending percentage is greater than or equal to `alertAt` for a group, THE Budget_Alert_Cron SHALL call `notify()` for every member of that group.
5. WHEN notifications have been sent for a group, THE Budget_Alert_Cron SHALL set `alertSentAt` to the current timestamp on that group's budget sub-document.
6. THE Budget_Alert_Cron SHALL be scheduled in `vercel.json` with the cron expression `0 */6 * * *` (every 6 hours).
7. THE Budget_Alert_Cron SHALL return HTTP 200 with a summary of groups processed and alerts sent upon successful completion.
8. IF an error occurs while processing a single group, THEN THE Budget_Alert_Cron SHALL log the error and continue processing remaining groups without aborting the entire job.

---

### Requirement 18: Mobile Chart Interactions

**User Story:** As a mobile user, I want all charts to respond to touch interactions, so that I can explore spending data on my phone without needing a mouse.

#### Acceptance Criteria

1. THE CategoryDonutChart SHALL respond to touch tap events to show the tooltip for the tapped segment.
2. THE SpendingTimelineChart SHALL respond to touch events to show the tooltip for the touched bar.
3. THE DailyTrendChart SHALL respond to touch events to show the tooltip for the touched data point.
4. THE MemberContributionChart SHALL respond to touch events to show the tooltip for the touched bar.
5. WHILE a chart is rendered on a viewport narrower than 768 px, THE System SHALL not clip or overflow chart content outside its container.
