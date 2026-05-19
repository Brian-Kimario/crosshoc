# Implementation Plan: Group Analytics & Spending Insights (Phase 11)

## Overview

Implement the analytics layer for SplitEasy in dependency order: shared utilities and data model extensions first, then API routes, then chart primitives, then composite panels, and finally integration into existing pages. Property-based tests are placed as sub-tasks immediately after the code they validate so errors are caught early.

---

## Tasks

- [x] 1. Extend Group model with budget sub-document
  - Add `IBudget` interface and optional `budget` field to `IGroup` in `lib/models/Group.ts`
  - Add the Mongoose schema block for `budget` (fields: `limitCents`, `currency`, `period`, `alertAt`, `alertSentAt`, `createdAt`) with correct types, enums, min/max, and defaults
  - Ensure the field is optional (`required: false`) for backward compatibility with existing groups
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Add SWR key functions and formatCurrencyCompact contract
  - Add `dashboardInsights`, `groupAnalytics`, and `groupBudget` key functions to `lib/swr-keys.ts`
  - Verify `formatCurrencyCompact` in `lib/format-utils.ts` matches the spec contract (≥$1M → `{sym}{n}M`, ≥$10K → `{sym}{n}K`, otherwise `formatMoney`); fix or extend if needed
  - _Requirements: 15.1–15.5, 16.1–16.3_

  - [x] 2.1 Write property tests for formatCurrencyCompact (P7 & P8)
    - **Property 7: formatCurrencyCompact applies correct threshold formatting**
    - **Property 8: formatCurrencyCompact round-trip approximation**
    - File: `__tests__/format-utils.pbt.test.ts`
    - Use `fc.integer({ min: 0, max: 999_999_999 })` to generate random cent amounts; assert threshold branching and round-trip within 0.1%
    - **Validates: Requirements 15.2, 15.3, 15.4, 15.5, 15.6**

- [x] 3. Create chart theme module
  - Create `lib/chart-theme.ts` exporting `CHART_COLORS` (≥6 hex strings), `CATEGORY_COLORS` (one entry per expense category), `CATEGORY_LABELS` (human-readable labels), `tooltipStyle` (dark CSS-in-JS object), and `getCategoryColor(category)` fallback function
  - Categories to cover: `food`, `transport`, `accommodation`, `entertainment`, `groceries`, `utilities`, `health`, `shopping`, `other`
  - _Requirements: 2.1–2.5_

- [x] 4. Install Recharts dependency
  - Run `pnpm add recharts` to add Recharts as a production dependency
  - Verify `recharts` appears in `package.json` dependencies
  - _Requirements: 1.1, 1.2_

- [x] 5. Implement Group Analytics API
  - Create `app/api/groups/[id]/analytics/route.ts` with a `GET` handler
  - Authenticate via `verifyAuth`; return 401 if unauthenticated, 400 for invalid ObjectId, 404 for missing group, 403 for non-members
  - Accept `period` query param (`7d`, `30d`, `90d`, `all`); translate to `$gte` date filter on `createdAt`
  - Use a single `Expense.aggregate()` with `$facet` to compute in parallel: category totals + percentages, ISO-week timeline buckets, member paid/owed breakdown, and summary stats (total, count, avg, largest)
  - Exclude voided expenses (`isVoided: { $ne: true }`) from all pipeline stages
  - Compute `budgetUtilization` from `group.budget` if present; return `null` otherwise
  - Return empty arrays and zero totals when no expenses match the period
  - Apply `checkRateLimit(request, "read")` rate limiting
  - _Requirements: 3.1–3.12_

  - [x] 5.1 Write property tests for Analytics API (P1, P2, P3)
    - **Property 1: Period filtering includes only in-window expenses**
    - **Property 2: Voided expenses are excluded from all totals**
    - **Property 3: Category percentages sum to 100**
    - File: `__tests__/group-analytics.pbt.test.ts`
    - Mock `Expense.aggregate` and `Group.findById`; generate random expense sets with varied `createdAt` and `isVoided` flags; assert period boundary inclusion/exclusion, voided exclusion, and percentage sum within 0.01 tolerance
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.10, 3.12**

- [x] 6. Implement Budget Management API
  - Create `app/api/groups/[id]/budget/route.ts` with `PUT` and `DELETE` handlers
  - `PUT`: validate body with Zod (`limitCents` integer ≥ 1, `period` enum, `alertAt` integer 50–100); return 422 on failure; persist budget sub-document; reset `alertSentAt` to `null`; return 200 with updated budget
  - `DELETE`: remove `budget` sub-document from group; return 200
  - Both handlers: authenticate, validate ObjectId, check membership, apply `checkRateLimit(request, "mutation")`
  - _Requirements: 6.1–6.8_

  - [x] 6.1 Write property tests for Budget API (P5 & P6)
    - **Property 5: Budget validation rejects all invalid inputs**
    - **Property 6: Budget update always resets alertSentAt to null**
    - File: `__tests__/budget-api.pbt.test.ts`
    - Generate random invalid bodies (out-of-range `limitCents`, invalid `period`, out-of-range `alertAt`) and assert 422; generate valid bodies and assert `alertSentAt === null` in the persisted document
    - **Validates: Requirements 6.2, 6.3, 6.5**

- [x] 7. Implement Dashboard Insights API
  - Create `app/api/dashboard/insights/route.ts` with a `GET` handler
  - Authenticate via `verifyAuth`; return 401 if unauthenticated
  - Fetch all groups the user belongs to; run `Expense.aggregate` scoped to those group IDs, excluding voided expenses
  - Compute: `thisMonthTotalCents`, `lastMonthTotalCents`, `monthChangePercent` (null when last month = 0), top 5 categories, `dailyTrend` (last 30 calendar days, zero-filled), `groupSpending` per group
  - Apply `checkRateLimit(request, "read")`
  - _Requirements: 4.1–4.6_

  - [x] 7.1 Write property tests for Dashboard Insights API (P4)
    - **Property 4: Daily trend covers exactly 30 days with no gaps**
    - File: `__tests__/dashboard-insights.pbt.test.ts`
    - Generate random expense date distributions across a 30-day window; assert the returned `dailyTrend` array has exactly 30 entries, no duplicate dates, and zero-filled entries for days with no expenses
    - **Validates: Requirements 4.4**

- [x] 8. Implement Budget Alert Cron Job
  - Create `app/api/cron/budget-alerts/route.ts` with a `GET` handler
  - Authenticate via `x-cron-secret` header matching `CRON_SECRET` env var; return 401 on mismatch
  - Query all groups with `budget` set and `budget.alertSentAt: null`
  - For each group: aggregate current spending (excluding voided), compute percentage, call `notify()` for every member if `spentPercent >= alertAt`, then set `alertSentAt` to `Date.now()`
  - Wrap each group in individual `try/catch`; log errors and increment error counter without aborting the loop (pattern from `app/api/cron/invite-expiry/route.ts`)
  - Return `{ processed, alertsSent, errors }` on success
  - Add cron entry to `vercel.json`: `{ "path": "/api/cron/budget-alerts", "schedule": "0 */6 * * *" }`
  - _Requirements: 17.1–17.8_

  - [x] 8.1 Write property tests for Budget Alert Cron (P10)
    - **Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups**
    - File: `__tests__/budget-alerts.pbt.test.ts`
    - Mock `Group.find`, `Expense.aggregate`, and `notify`; generate random groups with varying `spentPercent` and `alertAt` values; assert `notify` is called for every member of qualifying groups and `alertSentAt` is set to a non-null timestamp
    - **Validates: Requirements 17.4, 17.5**

- [x] 9. Checkpoint — API layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement CategoryDonutChart component
  - Create `components/analytics/CategoryDonutChart.tsx` as a `"use client"` component
  - Render a Recharts `<PieChart>` in donut style using `CHART_COLORS` and `CATEGORY_COLORS` from `lib/chart-theme.ts`
  - Implement custom tooltip showing `CATEGORY_LABELS[category]` and `formatMoney(totalCents, currency)`
  - Render a legend below the chart with color dot and label per category
  - Accept `size` prop (`sm` | `md` | `lg`) controlling chart dimensions
  - Render empty-state message when `data` is empty
  - Wrap in `<ResponsiveContainer width="100%" />` with `overflow-hidden` on the container div
  - _Requirements: 7.1–7.6, 18.1, 18.5_

  - [x] 10.1 Write property tests for chart tooltip formatters (P11 — CategoryDonutChart portion)
    - **Property 11: Chart tooltip formatters include required fields for any data point (CategoryDonutChart)**
    - File: `__tests__/chart-tooltips.pbt.test.ts`
    - Generate random `{ category, totalCents, percentage }` data points; call the tooltip formatter function directly; assert output includes a non-empty category label string and a formatted amount string
    - **Validates: Requirements 7.2**

- [x] 11. Implement SpendingTimelineChart component
  - Create `components/analytics/SpendingTimelineChart.tsx` as a `"use client"` component
  - Render a Recharts `<BarChart>` with one bar per ISO week entry
  - Implement custom tooltip showing the ISO week string and `formatMoney(totalCents, currency)`
  - Render compact Y-axis tick labels using `formatCurrencyCompact`
  - Render empty-state message when `data` is empty
  - Wrap in `<ResponsiveContainer width="100%" />` with `overflow-hidden`
  - _Requirements: 8.1–8.5, 18.2, 18.5_

  - [x] 11.1 Write property tests for chart tooltip formatters (P11 — SpendingTimelineChart portion)
    - **Property 11: Chart tooltip formatters include required fields for any data point (SpendingTimelineChart)**
    - File: `__tests__/chart-tooltips.pbt.test.ts` (extend existing file)
    - Generate random `{ week, totalCents }` data points; call the tooltip formatter; assert output includes the ISO week string and a formatted amount string
    - **Validates: Requirements 8.2**

- [x] 12. Implement DailyTrendChart component
  - Create `components/analytics/DailyTrendChart.tsx` as a `"use client"` component
  - Render a Recharts `<AreaChart>` with one data point per calendar day
  - Accept `height` prop (number) controlling chart height in pixels
  - Render compact Y-axis tick labels using `formatCurrencyCompact`
  - Render empty-state message when all `totalCents` values are zero
  - Wrap in `<ResponsiveContainer width="100%" />` with `overflow-hidden`
  - _Requirements: 9.1–9.5, 18.3, 18.5_

- [x] 13. Implement MemberContributionChart component
  - Create `components/analytics/MemberContributionChart.tsx` as a `"use client"` component
  - Render a Recharts horizontal `<BarChart>` with two bars per member (`paidCents` and `owedCents`)
  - Sort input data by `paidCents` descending and cap at 8 members before rendering
  - Visually highlight the bar row for `currentUserId` (e.g. teal border or background tint)
  - Implement custom tooltip showing member name, `formatMoney(paidCents)`, and `formatMoney(owedCents)`
  - Render empty-state message when `data` is empty
  - Wrap in `<ResponsiveContainer width="100%" />` with `overflow-hidden`
  - _Requirements: 10.1–10.6, 18.4, 18.5_

  - [x] 13.1 Write property tests for MemberContributionChart ordering (P9)
    - **Property 9: Member contribution chart orders by paid descending and caps at 8**
    - File: `__tests__/member-chart.pbt.test.ts`
    - Generate random `memberBreakdown` arrays of arbitrary length (0–50 entries) with random `paidCents`; apply the sort+cap transformation; assert result length ≤ 8 and entries are ordered by `paidCents` descending
    - **Validates: Requirements 10.2**

  - [x] 13.2 Write property tests for chart tooltip formatters (P11 — MemberContributionChart portion)
    - **Property 11: Chart tooltip formatters include required fields for any data point (MemberContributionChart)**
    - File: `__tests__/chart-tooltips.pbt.test.ts` (extend existing file)
    - Generate random `{ userId, name, paidCents, owedCents }` data points; call the tooltip formatter; assert output includes the member name, a formatted paid amount, and a formatted owed amount
    - **Validates: Requirements 10.4**

- [x] 14. Implement BudgetCard component
  - Create `components/analytics/BudgetCard.tsx` as a `"use client"` component
  - When `budgetUtilization` is `null`: render a dashed "Set a budget" button that expands an inline form
  - Inline form fields: limit amount input (display currency, converted to cents on submit), period selector (`monthly` | `per-trip` | `total`), save/cancel actions
  - When budget is set: render a progress bar (`spentCents / limitCents`), spent/remaining/limit amounts via `formatMoney`, edit and delete action buttons
  - Progress bar color: green when `usedPercent < 80`, amber when 80–99, rose when ≥ 100 (with "Over budget" badge)
  - `PUT` calls `keys.groupBudget(groupId)` endpoint; `DELETE` calls the same; both trigger SWR `mutate` on `keys.groupAnalytics(groupId, period)` after success
  - Display inline field-level validation errors on save failure; show toast-style error on network failure
  - _Requirements: 13.1–13.11_

- [x] 15. Implement GroupAnalyticsPanel component
  - Create `components/analytics/GroupAnalyticsPanel.tsx` as a `"use client"` component
  - Own period selector state (`"30d"` default); fetch from `keys.groupAnalytics(groupId, period)` via SWR
  - Render period selector buttons: `7d`, `30d`, `90d`, `all`
  - Render four summary stat cards: total spent, number of expenses, average expense, largest expense (description + amount)
  - Render `BudgetCard` passing `budgetUtilization` and `groupId`
  - Render `CategoryDonutChart` and `SpendingTimelineChart` in a two-column grid on desktop (`lg:grid-cols-2`), stacked on mobile
  - Render `MemberContributionChart` below the two-column grid
  - Render a callout card for the largest expense (description + formatted amount)
  - Render skeleton placeholders (matching the project's `animate-pulse` pattern from `components/skeletons.tsx`) while SWR is loading
  - Render an error card with a "Retry" button calling `mutate()` when SWR returns an error
  - _Requirements: 12.1–12.10_

- [x] 16. Implement DashboardInsights component
  - Create `components/dashboard/DashboardInsights.tsx` as a `"use client"` component
  - Fetch from `keys.dashboardInsights()` via SWR; return `null` when `thisMonthTotalCents === 0` or on error
  - Display total spent this month via `formatMoney`
  - Display trend indicator: rose icon + value when `monthChangePercent > 0`, emerald when ≤ 0; omit when `monthChangePercent` is `null`
  - Render `DailyTrendChart` with `height={120}`
  - Render top categories list with a color dot per category using `CATEGORY_COLORS`
  - Render per-group spending breakdown (group name + `formatMoney(spentCents, currency)`)
  - _Requirements: 14.1–14.9_

- [x] 17. Checkpoint — Component layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Add Analytics tab to group detail page
  - Modify `app/(dashboard)/groups/[groupId]/group-page-content.tsx` (or create it if the tab bar lives in the page) to add a tab bar with "Expenses" and "Analytics" tabs using Lucide React icons
  - "Expenses" tab is active by default and renders the existing `<ExpensesSection>` content
  - "Analytics" tab renders `<GroupAnalyticsPanel groupId={groupId} currency={currency} currentUserId={currentUserId} />`
  - Preserve all existing group detail page functionality when the "Expenses" tab is active
  - _Requirements: 11.1–11.5_

- [x] 19. Integrate DashboardInsights into DashboardOverview
  - Import and render `<DashboardInsights />` in `components/dashboard/DashboardOverview.tsx` between the stat cards section and the "Your Groups" grid section
  - _Requirements: 14.10_

- [x] 20. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All monetary values must remain as integer cents in API responses and component props; convert to display strings only at the render boundary using `formatMoney` or `formatCurrencyCompact`
- PBT files follow the naming convention `__tests__/{feature}.pbt.test.ts` and use `fast-check` with `numRuns: 100`
- Each PBT file header must include the tag comment: `// Feature: group-analytics-spending-insights, Property {N}: {property_text}`
- Chart components must use `<ResponsiveContainer width="100%" />` and `overflow-hidden` on their container divs to prevent horizontal overflow at 390 px viewport width
- The `budget` field on Group is optional — all existing group reads remain unaffected
- The cron job error-isolation pattern (per-group `try/catch`) mirrors `app/api/cron/invite-expiry/route.ts`
