# Implementation Plan: SplitEasy Phase 12 — Advanced Group Features

## Overview

Implement seven capability areas in strict build order: role-based group permissions, group archiving, recurring expenses, expense comments, expense edit history, cross-group debt consolidation, and multi-currency exchange rate management. Each part builds on the previous. All monetary values are integer cents displayed via `formatMoney(cents, currency)`. Every UI feature must work at 390px viewport width.

**Off-limits files:** `lib/balance-server.ts`, `lib/rate-limit.ts`, `lib/validations.ts`, existing expense/settlement API routes, auth configuration, `formatMoney` in `lib/money.ts`.

**Stack:** Next.js 14 App Router, MongoDB/Mongoose, custom JWT, Tailwind CSS, Shadcn UI, Framer Motion, Lucide React, SWR.

---

## Tasks

- [x] 1. PART 1 — Group Roles and Permissions: Update Group model with role-aware member structure
  - [x] 1.1 Update `lib/models/Group.ts` — replace flat `members[]` with role-aware sub-document `{ user: ObjectId, role: "owner"|"admin"|"member", joinedAt: Date }`, add `createdBy` field for backwards compatibility, add `status` field placeholder (will be extended in Part 2), add index on `{ "members.user": 1 }` if not already present
    - The member sub-document shape must match `IGroupMember` from the design
    - `createdBy` mirrors the existing `creator` field for backwards compatibility
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create `lib/group-permissions.ts` — export `GroupRole` type, `GroupPermission` type, `GroupMember` interface, `PERMISSION_MATRIX` constant, `getUserRole()` function, and `assertCan()` function
    - Implement the full permission matrix exactly as specified in the design table
    - `assertCan` must throw `{ status: 403, message: "Forbidden: insufficient permissions" }` when denied
    - `getUserRole` must return `null` when the user is not a member
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 Write property test for `assertCan` correctness
    - **Property 1: assertCan correctness**
    - **Validates: Requirements 2.2, 2.4, 2.5**
    - Generate random members array (valid roles), random userId (in array or not), random permission; assert: if userId not in array → always throws 403; if userId in array → throws iff `PERMISSION_MATRIX[role]` excludes that permission
    - Tag: `Feature: advanced-group-features, Property 1`

  - [x] 1.4 Create `scripts/migrate-group-roles.ts` — idempotent migration script that converts all existing flat `members[]` arrays to role-aware structure
    - Assign `"owner"` to the group creator, `"member"` to all other members
    - Set `joinedAt` to the group's `createdAt` date for all migrated members
    - If creator is not in the existing members array, add them as an `"owner"` member
    - Detect already-migrated groups by checking if the first member has a `role` field (skip if so)
    - Set `createdBy = creator` on all documents
    - Log each group processed and any errors encountered
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 1.5 Create `app/api/groups/[id]/members/route.ts` — PATCH (change role) and DELETE (remove/leave)
    - PATCH: validate `userId` and `role` in body; call `assertCan(group, requestingUserId, "changeRole")`; update member's role; return 200 with updated members list
    - DELETE: if `userId === requestingUserId` → self-leave (no extra permission needed beyond membership); if `userId !== requestingUserId` → call `assertCan(group, requestingUserId, "removeMember")`
    - Both operations must reject with HTTP 400 if the operation would remove the last owner
    - Return 200 with updated members list on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.6 Write property test for last-owner protection
    - **Property 2: Last-owner protection**
    - **Validates: Requirements 3.5**
    - Generate group with exactly one owner (may have other members with any role), DELETE request targeting that owner; assert: API returns HTTP 400
    - Tag: `Feature: advanced-group-features, Property 2`

  - [x] 1.7 Update all group queries to use `"members.user"` pattern
    - Replace all `members: userId` membership filter queries with `"members.user": userId`
    - Replace all `populate("members")` calls with `populate("members.user")`
    - Ensure all group API responses include each member's `role` and `joinedAt` fields
    - Audit files: `app/api/groups/route.ts`, `app/api/groups/[id]/route.ts`, and any other files that query or populate group members
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Checkpoint — Ensure all tests pass after Part 1
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. PART 2 — Group Archive: Add archive fields and API
  - [x] 3.1 Update `lib/models/Group.ts` — add `status` (`"active"|"archived"`, default `"active"`, indexed), `archivedAt` (Date), `archivedBy` (ObjectId ref User), `archiveNote` (String) fields
    - Add `{ status: 1 }` index to the schema
    - _Requirements: 5.1, 5.2_

  - [x] 3.2 Create `app/api/groups/[id]/archive/route.ts` — POST (archive) and DELETE (restore)
    - POST: call `assertCan(group, userId, "archiveGroup")`; set `status: "archived"`, `archivedAt: new Date()`, `archivedBy: userId`, `archiveNote` from body (optional); if group has unsettled balances include `warning` in response but still complete the operation; return 200
    - DELETE: call `assertCan(group, userId, "archiveGroup")`; set `status: "active"`, clear `archivedAt`, `archivedBy`, `archiveNote`; return 200
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.3 Write property test for archive/unarchive round-trip
    - **Property 5: Archive/unarchive round-trip**
    - **Validates: Requirements 6.1, 6.4**
    - Generate active group with random name, currency, and member composition; assert: after archive then restore, `status === "active"` and `archivedAt`, `archivedBy`, `archiveNote` are all cleared
    - Tag: `Feature: advanced-group-features, Property 5`

  - [x] 3.4 Update `app/api/groups/route.ts` — filter archived by default, support `?archived=true`
    - Default GET: add `{ status: { $ne: "archived" } }` (or `status: "active"`) to the query filter
    - When `?archived=true` query param is present: include archived groups in results
    - _Requirements: 7.1, 7.2_

  - [x] 3.5 Write property test for default groups list excluding archived
    - **Property 6: Default groups list excludes archived**
    - **Validates: Requirements 7.1**
    - Generate random set of groups with mixed `status` values; assert: GET `/api/groups` (no params) returns only groups with `status === "active"`
    - Tag: `Feature: advanced-group-features, Property 6`

  - [x] 3.6 Update groups list UI — "Show archived" toggle and archived group visual indicator
    - Add a "Show archived" toggle to `app/(dashboard)/groups/page.tsx`; when enabled, fetch from `/api/groups?archived=true`
    - Render a visual indicator (e.g., muted badge or greyed styling) on archived group cards
    - Must render correctly at 390px viewport width
    - _Requirements: 7.3, 7.4_

  - [x] 3.7 Block adding expenses to archived groups in the expense API
    - In the existing POST expense route, after loading the group, check `group.status === "archived"` and return HTTP 403 with `{ success: false, error: "Cannot add expenses to an archived group" }` if true
    - Do not modify any other logic in the expense route
    - _Requirements: 7.5_

  - [x] 3.8 Write property test for archived group expense rejection
    - **Property 4: Archived group expense rejection**
    - **Validates: Requirements 7.5**
    - Generate archived group, random valid expense payload, random member role for requesting user; assert: POST to add expense always returns HTTP 403
    - Tag: `Feature: advanced-group-features, Property 4`

  - [x] 3.9 Write property test for permission enforcement on mutating endpoints
    - **Property 3: Permission enforcement on mutating endpoints**
    - **Validates: Requirements 3.2, 3.4, 6.2, 6.5, 9.3, 9.5**
    - Generate random members array where requesting user's role lacks the required permission (changeRole / removeMember / archiveGroup / manageRecurring); assert: corresponding API endpoint returns HTTP 403
    - Tag: `Feature: advanced-group-features, Property 3`

- [x] 4. Checkpoint — Ensure all tests pass after Part 2
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. PART 3 — Recurring Expenses: Schema, API, and cron job
  - [x] 5.1 Update `lib/models/Expense.ts` — add `recurringConfig` sub-document
    - Add `recurringConfig` optional sub-document with fields: `enabled` (Boolean), `frequency` (enum daily/weekly/biweekly/monthly), `nextDueAt` (Date), `endDate` (Date, optional), `templateId` (ObjectId ref RecurringExpense), `parentId` (ObjectId ref RecurringExpense), `generationCount` (Number)
    - Also add `editHistory` array field (empty array default) with the `IEditHistoryEntry` shape: `editedBy`, `editedAt`, `changes` (string[]), `before` snapshot (`description`, `amount`, `category`, `splits`)
    - _Requirements: 8.2, 12.1_

  - [x] 5.2 Create `lib/models/RecurringExpense.ts` — full template model
    - Fields: `group`, `description`, `amount` (positive integer cents), `category`, `paidBy`, `splits` (array of `{ user, amount }` in cents), `splitType`, `frequency`, `startDate`, `endDate` (optional), `nextDueAt`, `isActive` (default true), `pausedAt` (optional), `generationCount` (default 0), `lastGeneratedAt` (optional), `createdBy`, `createdAt`
    - Add validator: `amount` must be a positive integer
    - Add indexes: `{ group: 1, isActive: 1 }` and `{ nextDueAt: 1, isActive: 1 }`
    - _Requirements: 8.1, 8.3_

  - [x] 5.3 Create `app/api/groups/[id]/recurring/route.ts` — GET and POST
    - GET: return all `isActive: true` RecurringExpense documents for the group; return 200 with `{ recurringExpenses }`
    - POST: call `assertCan(group, userId, "manageRecurring")`; validate `amount` is a positive integer (400 if not); create RecurringExpense document; return 201 with `{ recurringExpense }`
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 5.4 Create `app/api/groups/[id]/recurring/[recurringId]/route.ts` — DELETE (stop)
    - DELETE: call `assertCan(group, userId, "manageRecurring")`; set `isActive: false` on the RecurringExpense; return 200 with `{ recurringExpense: { isActive: false } }`
    - _Requirements: 9.4, 9.5_

  - [x] 5.5 Write property test for recurring expense amount integrity
    - **Property 7: Recurring expense amount integrity**
    - **Validates: Requirements 8.3, 9.6, 10.3**
    - Generate random positive integer `amount`, random frequency, random splits summing to `amount`; assert: generated Expense `amount === template.amount`; all split amounts are integers
    - Tag: `Feature: advanced-group-features, Property 7`

  - [x] 5.6 Create `app/api/cron/recurring-expenses/route.ts` — daily cron job handler
    - Query all RecurringExpense documents where `isActive: true` AND `nextDueAt <= now`
    - For each due template: create a new Expense document using `description`, `amount`, `category`, `paidBy`, `splits`, `splitType` from the template
    - Advance `nextDueAt` to the next occurrence based on `frequency` (daily +1d, weekly +7d, biweekly +14d, monthly +1 calendar month)
    - Increment `generationCount` and set `lastGeneratedAt = now`
    - Invalidate `cachedBalances` on the affected group
    - Send notifications to all split participants
    - If advancing `nextDueAt` would exceed `endDate`, set `isActive: false` instead
    - Wrap each template in try/catch; log errors; return summary `{ processed: N, failed: M }`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 5.7 Write property test for nextDueAt advancement correctness
    - **Property 8: nextDueAt advancement correctness**
    - **Validates: Requirements 10.4**
    - Generate random `nextDueAt` date, random `frequency` from the allowed set; assert: advanced date is exactly one period later (daily +1d, weekly +7d, biweekly +14d, monthly +1 calendar month)
    - Tag: `Feature: advanced-group-features, Property 8`

  - [x] 5.8 Write property test for endDate deactivation
    - **Property 9: endDate deactivation**
    - **Validates: Requirements 10.7**
    - Generate RecurringExpense where `nextDueAt + 1 period > endDate`; assert: after cron processing, `isActive === false`
    - Tag: `Feature: advanced-group-features, Property 9`

  - [x] 5.9 Update `vercel.json` — add recurring-expenses cron entry
    - Add `{ "path": "/api/cron/recurring-expenses", "schedule": "0 6 * * *" }` to the `crons` array
    - Retain all existing cron entries (`invite-expiry`, `invite-expiring`, `budget-alerts`) unchanged
    - _Requirements: 21.1, 21.2_

- [x] 6. Checkpoint — Ensure all tests pass after Part 3
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. PART 4 — Expense Comments: Model and API
  - [x] 7.1 Create `lib/models/ExpenseComment.ts`
    - Fields: `expense` (ObjectId ref Expense), `group` (ObjectId ref Group), `author` (ObjectId ref User, optional), `authorName` (String), `isGuest` (Boolean, default false), `guestId` (String, optional), `text` (String, required), `editedAt` (Date, optional), `deletedAt` (Date, optional), `createdAt` (Date)
    - Add indexes: `{ expense: 1, createdAt: 1 }` and `{ expense: 1, deletedAt: 1 }`
    - _Requirements: 11.1_

  - [x] 7.2 Create `app/api/expenses/[id]/comments/route.ts` — GET and POST
    - GET: return all comments where `deletedAt` is not set, ordered by `createdAt` ascending; return 200 with `{ comments }`
    - POST: validate `text` is non-empty and not whitespace-only (400 if invalid); create ExpenseComment; if commenter is not the expense payer, send notification to payer; return 201 with `{ comment }`
    - _Requirements: 11.2, 11.3, 11.6, 11.7_

  - [x] 7.3 Write property test for comment soft-delete exclusion
    - **Property 10: Comment soft-delete exclusion**
    - **Validates: Requirements 11.2, 11.4**
    - Generate random list of comments, random subset with `deletedAt` set; assert: GET response contains only comments where `deletedAt` is not set
    - Tag: `Feature: advanced-group-features, Property 10`

  - [x] 7.4 Write property test for comment text validation
    - **Property 11: Comment text validation**
    - **Validates: Requirements 11.7**
    - Generate strings composed entirely of whitespace characters (spaces, tabs, `\n`, `\r`, combinations); assert: POST returns HTTP 400, no ExpenseComment document created
    - Tag: `Feature: advanced-group-features, Property 11`

  - [x] 7.5 Create `app/api/expenses/[id]/comments/[commentId]/route.ts` — DELETE (soft delete)
    - DELETE: verify requesting user is the comment author OR has `deleteAnyComment` permission (403 otherwise); soft-delete by setting `deletedAt = new Date()`; return 200 with `{ comment: { deletedAt } }`
    - _Requirements: 11.4, 11.5_

- [ ] 8. PART 5 — Expense Edit History: Capture before-snapshot on PUT
  - [x] 8.1 Update PUT `/api/groups/[id]/expenses/[expenseId]` — capture before snapshot and append to editHistory
    - Before applying any updates, capture a snapshot of the current `description`, `amount`, `category`, and `splits` values
    - Determine which fields changed by comparing snapshot to incoming request body
    - After a successful save, append a new `IEditHistoryEntry` to `editHistory`: `{ editedBy: userId, editedAt: new Date(), changes: [...changedFieldNames], before: snapshot }`
    - Do not modify any other logic in the existing PUT route; do not touch other expense routes
    - _Requirements: 12.2, 12.3, 12.4_

  - [x] 8.2 Write property test for edit history append-only with accurate snapshots
    - **Property 12: Edit history append-only with accurate snapshots**
    - **Validates: Requirements 12.2, 12.3, 12.4**
    - Generate expense with random field values, sequence of N random updates; assert: `editHistory.length === N`; no prior entry is mutated; each `before` snapshot matches the pre-update field values
    - Tag: `Feature: advanced-group-features, Property 12`

- [x] 9. Checkpoint — Ensure all tests pass after Parts 4 and 5
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. PART 6 — Cross-Group Debt Consolidation: API and dashboard component
  - [x] 10.1 Create `app/api/user/consolidate-debts/route.ts`
    - Aggregate balances across all active groups where the requesting user is a member
    - Group results by counterparty user ID; compute `netCents` (positive = they owe me, negative = I owe them)
    - Exclude guest counterparties from results
    - Return: `{ consolidatedDebts[], totalOwedToMeCents, totalIOweCents, groupCount }`
    - Each `consolidatedDebts` entry: `{ userId, userName, netCents, groups: [{ groupId, groupName, balanceCents }] }`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 10.2 Write property test for debt consolidation correctness
    - **Property 13: Debt consolidation correctness**
    - **Validates: Requirements 13.2, 13.3, 13.4**
    - Generate random multi-group balance scenarios with a mix of registered users and guests; assert: `netCents` sign is correct; `totalOwedToMeCents === sum of positive netCents`; `totalIOweCents === |sum of negative netCents|`; no guest in `consolidatedDebts`
    - Tag: `Feature: advanced-group-features, Property 13`

  - [x] 10.3 Create `components/dashboard/ConsolidatedDebts.tsx`
    - Fetch data via SWR using `keys.consolidatedDebts()`
    - Display loading skeleton while fetching
    - Each row: counterparty name + net balance via `formatMoney(netCents, currency)`
    - Tap/click expands per-group breakdown using Framer Motion `AnimatePresence`
    - Must render correctly at 390px viewport width
    - _Requirements: 14.1, 14.3, 14.4, 14.5_

  - [x] 10.4 Update `components/dashboard/DashboardOverview.tsx` — add `ConsolidatedDebts` below groups grid
    - Import and render `<ConsolidatedDebts />` below the existing groups grid
    - Do not modify any other logic in `DashboardOverview.tsx`
    - _Requirements: 14.2_

- [ ] 11. PART 7 — Multi-Currency: Exchange rate model, conversion utility, API, and admin page
  - [x] 11.1 Create `lib/models/ExchangeRate.ts`
    - Fields: `base` (String, currency code), `target` (String, currency code), `rate` (Number, positive), `source` (String), `fetchedAt` (Date)
    - Add unique compound index: `{ base: 1, target: 1 }`
    - _Requirements: 15.1, 15.2_

  - [x] 11.2 Add `convertCents()` to `lib/money.ts` — do NOT modify `formatMoney` or any existing exports
    - Export `async function convertCents(cents: number, fromCurrency: string, toCurrency: string): Promise<number>`
    - If `fromCurrency === toCurrency`, return `cents` immediately (no DB call)
    - Query `ExchangeRate` collection for the matching `{ base: fromCurrency, target: toCurrency }` record
    - If found, return `Math.round(cents * rate)` to maintain integer cents invariant
    - If not found, log a `console.warn` and return original `cents` unchanged
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 11.3 Write property test for convertCents correctness
    - **Property 14: convertCents correctness**
    - **Validates: Requirements 16.1, 16.2**
    - Generate random integer cents, random currency codes, random positive exchange rates; assert: `convertCents(cents, c, c) === cents` for any currency `c`; output is always an integer for any positive rate
    - Tag: `Feature: advanced-group-features, Property 14`

  - [x] 11.4 Create `app/api/admin/exchange-rates/route.ts` — GET and POST (upsert)
    - GET: verify requesting user has system-level admin role (403 otherwise); return all ExchangeRate records
    - POST: verify system admin; validate `rate` is a positive number (400 if not); upsert ExchangeRate for `{ base, target }` pair; return 200 with `{ exchangeRate }`
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 11.5 Create `app/admin/exchange-rates/page.tsx` — table + inline edit form
    - Display a table of all ExchangeRate records showing `base`, `target`, `rate`, and `fetchedAt`
    - Include an inline edit form to update the `rate` for an existing pair or add a new pair
    - Add "Exchange Rates" entry to the admin sidebar navigation
    - Must render correctly at 390px viewport width (table scrolls horizontally or stacks)
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 12. Checkpoint — Ensure all tests pass after Parts 6 and 7
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. PART 8 — UI: Recurring Expenses Section
  - [x] 13.1 Create `components/groups/RecurringExpensesSection.tsx`
    - Props: `{ groupId: string; canManage: boolean; currency: string }`
    - Fetch data via SWR using `keys.groupRecurring(groupId)`
    - Display skeleton loading states while fetching
    - Each item: `description`, frequency label (e.g. "Monthly"), `nextDueAt` formatted date, overdue badge if `nextDueAt < now`
    - When `canManage === true`: show "Add" button (opens inline form to POST new recurring expense) and "Stop" button on each item (calls DELETE)
    - Must render correctly at 390px viewport width; action buttons min 44px tap target
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.6_

  - [x] 13.2 Update `app/(dashboard)/groups/[groupId]/page.tsx` — add `RecurringExpensesSection` to right panel with permission checks
    - Determine `canManage` by checking if the current user's role has the `manageRecurring` permission using `getUserRole` + `PERMISSION_MATRIX`
    - Render `<RecurringExpensesSection groupId={groupId} canManage={canManage} currency={group.currency} />` in the right panel
    - _Requirements: 19.5_

- [ ] 14. PART 9 — Comment UI on Expense Cards
  - [x] 14.1 Update `components/groups/ExpenseCard.tsx` (or `expenses-section.tsx`) — add expandable comment section
    - Add a comment toggle button showing the count of non-deleted comments (badge)
    - When toggled open, fetch comments via SWR using `keys.expenseComments(expenseId)` (only fetch when expanded)
    - Render comment list: each comment shows author name and text
    - Add comment input field with `text-base` class (16px font-size) to prevent iOS auto-zoom
    - Enter key submits new comment (POST); Shift+Enter inserts newline
    - Animate expand/collapse using Framer Motion `AnimatePresence`
    - Must render correctly at 390px viewport width; comment list scrollable
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [ ] 15. PART 10 — SWR Keys and Final Wiring
  - [x] 15.1 Update `lib/swr-keys.ts` — add all new SWR key functions
    - Add: `groupRecurring: (groupId: string) => \`/api/groups/${groupId}/recurring\``
    - Add: `expenseComments: (expenseId: string) => \`/api/expenses/${expenseId}/comments\``
    - Add: `consolidatedDebts: () => "/api/user/consolidate-debts"`
    - Add: `adminExchangeRates: () => "/api/admin/exchange-rates"`
    - Add: `archivedGroups: () => "/api/groups?archived=true"`
    - Do not modify or remove any existing keys
    - _Requirements: 4.1, 9.1, 11.2, 13.1, 17.1_

- [ ] 16. PART 11 — Property-Based Tests
  - [x] 16.1 Create `__tests__/advanced-group-features.pbt.test.ts` — implement all 14 correctness properties using fast-check
    - Minimum 100 iterations per property (`{ numRuns: 100 }`)
    - Each test tagged: `Feature: advanced-group-features, Property N`
    - Import and test pure logic functions directly (no HTTP calls for pure-logic properties); use mock/in-memory data for API-level properties
    - [x] 16.2 Property 1 — assertCan correctness (Requirements 2.2, 2.4, 2.5)
    - [x] 16.3 Property 2 — Last-owner protection (Requirements 3.5)
    - [x] 16.4 Property 3 — Permission enforcement on mutating endpoints (Requirements 3.2, 3.4, 6.2, 6.5, 9.3, 9.5)
    - [x] 16.5 Property 4 — Archived group expense rejection (Requirements 7.5)
    - [x] 16.6 Property 5 — Archive/unarchive round-trip (Requirements 6.1, 6.4)
    - [x] 16.7 Property 6 — Default groups list excludes archived (Requirements 7.1)
    - [x] 16.8 Property 7 — Recurring expense amount integrity (Requirements 8.3, 9.6, 10.3)
    - [x] 16.9 Property 8 — nextDueAt advancement correctness (Requirements 10.4)
    - [x] 16.10 Property 9 — endDate deactivation (Requirements 10.7)
    - [x] 16.11 Property 10 — Comment soft-delete exclusion (Requirements 11.2, 11.4)
    - [x] 16.12 Property 11 — Comment text validation (Requirements 11.7)
    - [x] 16.13 Property 12 — Edit history append-only with accurate snapshots (Requirements 12.2, 12.3, 12.4)
    - [x] 16.14 Property 13 — Debt consolidation correctness (Requirements 13.2, 13.3, 13.4)
    - [x] 16.15 Property 14 — convertCents correctness (Requirements 16.1, 16.2)

- [x] 17. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major part
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- All monetary values must remain integer cents throughout — use `Math.round()` wherever conversion occurs
- `formatMoney(cents, currency)` is the only permitted display function for monetary values
- The `formatMoney` function itself must not be modified
