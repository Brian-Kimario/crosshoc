# Design Document: Group Analytics & Spending Insights

## Overview

Phase 11 of SplitEasy adds a comprehensive analytics layer to the application. The feature has three main surfaces:

1. **Group Analytics Tab** — a new "Analytics" tab on the group detail page showing category breakdowns, weekly spending timelines, member contribution comparisons, and a budget tracker.
2. **Dashboard Insights Panel** — a cross-group spending summary on the main dashboard showing monthly totals, daily trend, and top categories.
3. **Budget Management** — per-group budget configuration with threshold-based alert notifications delivered via the existing `notify()` system and a Vercel Cron job.

All monetary values remain in integer cents throughout the system. Charts are rendered with Recharts and must be fully responsive down to 390 px viewport width. The dark-theme visual language is codified in a shared `lib/chart-theme.ts` module.

---

## Architecture

```mermaid
graph TD
    subgraph Client
        A[GroupDetailPage] -->|tab switch| B[GroupAnalyticsPanel]
        B -->|SWR| C[/api/groups/id/analytics]
        B --> D[BudgetCard]
        D -->|PUT/DELETE| E[/api/groups/id/budget]
        B --> F[CategoryDonutChart]
        B --> G[SpendingTimelineChart]
        B --> H[MemberContributionChart]

        I[DashboardOverview] --> J[DashboardInsights]
        J -->|SWR| K[/api/dashboard/insights]
        J --> L[DailyTrendChart]
    end

    subgraph Server
        C --> M[(MongoDB Expense)]
        C --> N[(MongoDB Group)]
        E --> N
        K --> M
        K --> N
        O[/api/cron/budget-alerts] --> M
        O --> N
        O -->|notify| P[Notification]
    end

    subgraph Shared
        Q[lib/chart-theme.ts]
        R[lib/money.ts / formatMoney]
        S[lib/format-utils.ts / formatCurrencyCompact]
        F & G & H & L --> Q
        G & H & L --> S
    end
```

### Key Design Decisions

**Aggregation on the server, not the client.** All statistical computations (category totals, timeline bucketing, member breakdowns) happen in MongoDB aggregation pipelines on the server. The client receives pre-computed data and only handles rendering. This keeps chart components simple and avoids shipping large expense arrays to the browser.

**Period filtering via query parameter.** The analytics API accepts a `period` query parameter (`7d`, `30d`, `90d`, `all`). The server translates this to a `$gte` date filter on `createdAt`. This is simpler than date-range parameters and covers the four use cases identified in requirements.

**Budget stored as a sub-document on Group.** Budget configuration is tightly coupled to a group and has no independent lifecycle, so embedding it as a sub-document is the right choice. It avoids a separate collection and keeps group reads atomic.

**Cron-based budget alerts.** Budget threshold alerts are sent by a Vercel Cron job running every 6 hours rather than inline on every expense creation. This avoids adding latency to the expense creation path and batches notifications efficiently. The `alertSentAt` field prevents duplicate alerts within a budget period.

**`formatCurrencyCompact` already exists in `lib/format-utils.ts`.** The function is already implemented and used in the group detail page. The design confirms its contract and adds it to the SWR keys module's companion utilities.

---

## Components and Interfaces

### `lib/chart-theme.ts`

Exports shared constants for all chart components:

```typescript
export const CHART_COLORS: string[]          // ≥6 hex strings for dark backgrounds
export const CATEGORY_COLORS: Record<string, string>  // category → hex
export const CATEGORY_LABELS: Record<string, string>  // category → display label
export const tooltipStyle: React.CSSProperties        // dark Recharts tooltip style

// Fallback for unknown categories
export function getCategoryColor(category: string): string
```

Categories mirror the existing `category` field on `IExpense`: `food`, `transport`, `accommodation`, `entertainment`, `groceries`, `utilities`, `health`, `shopping`, `other`.

### `app/api/groups/[id]/analytics/route.ts`

```typescript
// GET /api/groups/[id]/analytics?period=30d
interface AnalyticsResponse {
  period: "7d" | "30d" | "90d" | "all";
  currency: string;
  totalSpentCents: number;
  totalExpenses: number;
  avgExpenseCents: number;
  largestExpense: { description: string; amountCents: number } | null;
  categoryBreakdown: Array<{ category: string; totalCents: number; percentage: number }>;
  timeline: Array<{ week: string; totalCents: number }>;       // week = "YYYY-Www"
  memberBreakdown: Array<{ userId: string; name: string; paidCents: number; owedCents: number }>;
  budgetUtilization: {
    limitCents: number;
    spentCents: number;
    usedPercent: number;
    remainingCents: number;
    isOverBudget: boolean;
  } | null;
}
```

Implementation uses a single `Expense.aggregate()` pipeline with `$match` (group + period + `isVoided: false`), `$facet` for parallel computation of category totals, timeline buckets, and member paid/owed amounts.

### `app/api/dashboard/insights/route.ts`

```typescript
// GET /api/dashboard/insights
interface InsightsResponse {
  thisMonthTotalCents: number;
  lastMonthTotalCents: number;
  monthChangePercent: number | null;   // null when lastMonth = 0
  topCategories: Array<{ category: string; totalCents: number }>;  // top 5
  dailyTrend: Array<{ date: string; totalCents: number }>;         // last 30 days, zero-filled
  groupSpending: Array<{ groupId: string; groupName: string; spentCents: number; currency: string }>;
}
```

### `app/api/groups/[id]/budget/route.ts`

```typescript
// PUT body (Zod-validated)
interface BudgetPutBody {
  limitCents: number;   // integer >= 1
  period: "monthly" | "per-trip" | "total";
  alertAt: number;      // integer 50–100, default 80
}

// Response: { budget: BudgetSubDoc }
```

### `app/api/cron/budget-alerts/route.ts`

```typescript
// GET — authenticated via x-cron-secret header
// Returns: { processed: number; alertsSent: number; errors: number }
```

### Chart Components

All chart components are `"use client"` and accept data as props (no internal SWR fetching).

```typescript
// CategoryDonutChart
interface CategoryDonutChartProps {
  data: Array<{ category: string; totalCents: number; percentage: number }>;
  currency: string;
  size?: "sm" | "md" | "lg";
}

// SpendingTimelineChart
interface SpendingTimelineChartProps {
  data: Array<{ week: string; totalCents: number }>;
  currency: string;
}

// DailyTrendChart
interface DailyTrendChartProps {
  data: Array<{ date: string; totalCents: number }>;
  currency: string;
  height?: number;
}

// MemberContributionChart
interface MemberContributionChartProps {
  data: Array<{ userId: string; name: string; paidCents: number; owedCents: number }>;
  currency: string;
  currentUserId: string;
}
```

### `components/analytics/GroupAnalyticsPanel.tsx`

Client component. Owns the period selector state and SWR fetch. Composes all chart components and `BudgetCard`. Renders skeleton placeholders during loading.

### `components/analytics/BudgetCard.tsx`

Client component. Reads `budgetUtilization` from the analytics response and manages its own form state for set/edit/delete actions. Calls `PUT /api/groups/[id]/budget` and `DELETE /api/groups/[id]/budget` directly, then triggers SWR revalidation.

### `components/dashboard/DashboardInsights.tsx`

Client component. Fetches from `/api/dashboard/insights` via SWR. Returns `null` when `thisMonthTotalCents === 0`. Renders `DailyTrendChart`, top categories list, and per-group spending breakdown.

---

## Data Models

### Budget Sub-Document (added to `lib/models/Group.ts`)

```typescript
interface IBudget {
  limitCents: number;           // positive integer
  currency: string;             // mirrors group currency
  period: "monthly" | "per-trip" | "total";
  alertAt: number;              // 50–100, default 80
  alertSentAt: Date | null;     // null = alert not yet sent
  createdAt: Date;
}

// Added to IGroup:
budget?: IBudget;
```

Mongoose schema addition:

```typescript
budget: {
  limitCents:   { type: Number, min: 1 },
  currency:     { type: String },
  period:       { type: String, enum: ["monthly", "per-trip", "total"] },
  alertAt:      { type: Number, min: 50, max: 100, default: 80 },
  alertSentAt:  { type: Date, default: null },
  createdAt:    { type: Date, default: Date.now },
}
```

The field is optional at the schema level (`required: false`) to maintain backward compatibility with existing groups.

### `lib/swr-keys.ts` additions

```typescript
dashboardInsights: () => "/api/dashboard/insights" as const,
groupAnalytics: (groupId: string, period: string) =>
  `/api/groups/${groupId}/analytics?period=${period}` as const,
groupBudget: (groupId: string) =>
  `/api/groups/${groupId}/budget` as const,
```

### `vercel.json` addition

```json
{
  "path": "/api/cron/budget-alerts",
  "schedule": "0 */6 * * *"
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Period filtering includes only in-window expenses

*For any* set of expenses with random `createdAt` timestamps and a given period value (`7d`, `30d`, `90d`), the analytics computation SHALL include exactly those expenses whose `createdAt` falls within the period window, and SHALL exclude all others.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5**

---

### Property 2: Voided expenses are excluded from all totals

*For any* set of expenses where some have `isVoided: true`, the computed `totalSpentCents` SHALL equal the sum of `amount` values for non-voided expenses only. This property holds for both the Analytics_API and the Insights_API.

**Validates: Requirements 3.10, 4.3**

---

### Property 3: Category percentages sum to 100

*For any* non-empty set of expenses grouped by category, the sum of all `percentage` values in `categoryBreakdown` SHALL equal 100 (within a tolerance of 0.01 to account for rounding).

**Validates: Requirements 3.12**

---

### Property 4: Daily trend covers exactly 30 days with no gaps

*For any* call to the Insights_API, the `dailyTrend` array SHALL contain exactly 30 entries, one for each of the last 30 calendar days, with no missing dates and `totalCents: 0` for days with no expenses.

**Validates: Requirements 4.4**

---

### Property 5: Budget validation rejects all invalid inputs

*For any* budget PUT request body where `limitCents < 1`, or `period` is not one of `monthly`/`per-trip`/`total`, or `alertAt` is outside the range [50, 100], the Budget_API SHALL return HTTP 422.

**Validates: Requirements 6.2, 6.3**

---

### Property 6: Budget update always resets alertSentAt to null

*For any* valid budget PUT request, the resulting budget sub-document stored in the database SHALL have `alertSentAt` equal to `null`, regardless of the previous value.

**Validates: Requirements 6.5**

---

### Property 7: formatCurrencyCompact applies correct threshold formatting

*For any* integer cent amount:
- If the display amount is ≥ $1,000,000, the output SHALL match the pattern `{symbol}{n}M` where `n` is rounded to one decimal place.
- If the display amount is ≥ $10,000 and < $1,000,000, the output SHALL match the pattern `{symbol}{n}K` where `n` is rounded to one decimal place.
- If the display amount is < $10,000, the output SHALL equal the result of `formatMoney` for the same amount.

**Validates: Requirements 15.2, 15.3, 15.4, 15.5**

---

### Property 8: formatCurrencyCompact round-trip approximation

*For any* valid non-negative integer cent amount, parsing the numeric portion of the `formatCurrencyCompact` output (stripping the symbol and suffix) and converting back to cents SHALL produce a value within 0.1% of the original display amount.

**Validates: Requirements 15.6**

---

### Property 9: Member contribution chart orders by paid descending and caps at 8

*For any* `memberBreakdown` array of arbitrary length, the data transformation for `MemberContributionChart` SHALL produce an array of at most 8 entries, ordered by `paidCents` descending.

**Validates: Requirements 10.2**

---

### Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups

*For any* group where the computed spending percentage is ≥ `alertAt` and `alertSentAt` is `null`, the Budget_Alert_Cron SHALL call `notify()` for every member of that group and SHALL set `alertSentAt` to a non-null timestamp on the budget sub-document.

**Validates: Requirements 17.4, 17.5**

---

### Property 11: Chart tooltip formatters include required fields for any data point

*For any* chart data point passed to a tooltip formatter function:
- `CategoryDonutChart` tooltip SHALL include the category label string and a formatted amount string.
- `SpendingTimelineChart` tooltip SHALL include the ISO week string and a formatted amount string.
- `MemberContributionChart` tooltip SHALL include the member name, a formatted paid amount, and a formatted owed amount.

**Validates: Requirements 7.2, 8.2, 10.4**

---

## Error Handling

### API Routes

All API routes follow the existing project pattern:

| Condition | HTTP Status | Response |
|---|---|---|
| Not authenticated | 401 | `{ success: false, error: "Unauthorized. Please login." }` |
| Not a group member | 403 | `{ success: false, error: "Forbidden" }` |
| Invalid ObjectId | 400 | `{ success: false, error: "Invalid group id" }` |
| Group not found | 404 | `{ success: false, error: "Group not found" }` |
| Zod validation failure | 422 | `{ success: false, errors: ZodError.flatten() }` |
| Internal error | 500 | `{ success: false, error: "Internal server error" }` |

Rate limiting uses the existing `checkRateLimit(request, "read")` preset for GET endpoints and `"mutation"` for PUT/DELETE.

### Cron Job Error Isolation

The budget alert cron processes groups in a `for` loop with individual `try/catch` blocks. A failure on one group (e.g., a corrupt budget document) is logged and counted in the `errors` field of the response, but does not abort processing of remaining groups. This matches the pattern in `app/api/cron/invite-expiry/route.ts`.

### Client-Side Error States

- `GroupAnalyticsPanel`: SWR `error` state renders an error card with a "Retry" button that calls `mutate()`.
- `DashboardInsights`: SWR `error` state renders nothing (the component returns `null` on error to avoid disrupting the dashboard layout).
- `BudgetCard`: Form submission errors display inline field-level messages. Network errors show a toast-style error message.

### Empty States

Each chart component renders a dedicated empty-state UI (icon + message) when its data array is empty or all values are zero. This prevents Recharts from rendering broken/empty SVGs.

---

## Testing Strategy

### Unit Tests (example-based)

- `lib/chart-theme.ts`: Verify `CHART_COLORS` length, `CATEGORY_COLORS` hex format, `CATEGORY_LABELS` non-empty strings, `tooltipStyle` has expected keys, fallback color for unknown category.
- `lib/swr-keys.ts`: Verify the three new key functions return the expected URL strings.
- `lib/format-utils.ts` (`formatCurrencyCompact`): Verify boundary values at exactly $10,000 and $1,000,000.
- `BudgetCard` color logic: Verify green/amber/rose class selection at 0%, 79%, 80%, 99%, 100%, 101%.
- `DashboardInsights` null return: Verify component returns null when `thisMonthTotalCents === 0`.
- API auth guards: Verify 401 for unauthenticated requests, 403 for non-members, 400 for invalid ObjectIds.

### Property-Based Tests

Property-based testing is appropriate for this feature because it contains pure transformation functions (formatCurrencyCompact, category percentage calculation, period filtering, member sorting) and data invariants (daily trend completeness, voided exclusion) that benefit from exhaustive input coverage.

**Library**: `fast-check` (already used in the project's existing PBT test files).

**Configuration**: Each property test runs a minimum of 100 iterations.

**Tag format**: `// Feature: group-analytics-spending-insights, Property {N}: {property_text}`

Property tests to implement:

| Property | Test file | What varies |
|---|---|---|
| P1: Period filtering | `__tests__/group-analytics.pbt.test.ts` | Expense dates, period value |
| P2: Voided exclusion | `__tests__/group-analytics.pbt.test.ts` | Expense sets with random voided flags |
| P3: Category % sum | `__tests__/group-analytics.pbt.test.ts` | Expense sets with random categories |
| P4: Daily trend 30 days | `__tests__/dashboard-insights.pbt.test.ts` | Expense dates across 30-day window |
| P5: Budget validation | `__tests__/budget-api.pbt.test.ts` | Random invalid budget bodies |
| P6: alertSentAt reset | `__tests__/budget-api.pbt.test.ts` | Random valid budget bodies |
| P7: Compact formatting thresholds | `__tests__/format-utils.pbt.test.ts` | Random cent amounts across all ranges |
| P8: Compact formatting round-trip | `__tests__/format-utils.pbt.test.ts` | Random non-negative cent amounts |
| P9: Member chart ordering | `__tests__/member-chart.pbt.test.ts` | Random memberBreakdown arrays |
| P10: Budget alert cron | `__tests__/budget-alerts.pbt.test.ts` | Random groups with varying spend % and alertAt |
| P11: Tooltip formatters | `__tests__/chart-tooltips.pbt.test.ts` | Random chart data points |

### Integration Tests

- `GET /api/groups/[id]/analytics`: End-to-end with a real MongoDB test database — verify response shape, period filtering, voided exclusion, and empty-group case.
- `GET /api/dashboard/insights`: End-to-end — verify daily trend zero-fill, month change percent null case.
- `PUT /api/groups/[id]/budget` + `DELETE /api/groups/[id]/budget`: Verify persistence and removal.
- `GET /api/cron/budget-alerts`: Verify 401 without secret, verify notification creation for qualifying groups.

### Mobile Responsiveness

Chart components use Recharts' `<ResponsiveContainer width="100%" />` wrapper. Manual testing at 390 px viewport width is required to verify no overflow. The `overflow-hidden` CSS class on chart container divs prevents horizontal scroll.
