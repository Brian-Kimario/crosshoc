# Design Document: SplitEasy Phase 12 — Advanced Group Features

## Overview

Phase 12 extends SplitEasy with seven major capability areas: role-based group permissions, group archiving, recurring expenses, expense comments, expense edit history, cross-group debt consolidation, and multi-currency exchange rate management. All features are built on the existing Next.js 14 App Router stack with MongoDB/Mongoose, custom JWT auth, Tailwind CSS, Shadcn UI, Framer Motion, and SWR.

**Key invariants that must be preserved throughout:**
- All monetary values are stored as integer cents; display uses `formatMoney(cents, currency)` exclusively.
- The `formatMoney` function in `lib/money.ts` must not be modified.
- `lib/balance-server.ts`, `lib/rate-limit.ts`, `lib/validations.ts`, and all existing expense/settlement API routes are off-limits.
- Every feature must render correctly at 390px viewport width.

---

## Architecture

The feature set follows the existing layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js App Router (app/)                                  │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Page Components │  │  API Route Handlers              │ │
│  │  (RSC + Client)  │  │  /api/groups/[id]/members        │ │
│  └──────────────────┘  │  /api/groups/[id]/archive        │ │
│                        │  /api/groups/[id]/recurring      │ │
│  ┌──────────────────┐  │  /api/expenses/[id]/comments     │ │
│  │  UI Components   │  │  /api/user/consolidate-debts     │ │
│  │  RecurringExpenses│  │  /api/admin/exchange-rates       │ │
│  │  ConsolidatedDebts│  │  /api/cron/recurring-expenses   │ │
│  │  ExpenseCard     │  └──────────────────────────────────┘ │
│  └──────────────────┘                                       │
├─────────────────────────────────────────────────────────────┤
│  Business Logic (lib/)                                      │
│  group-permissions.ts  │  money.ts (+ convertCents)        │
│  swr-keys.ts (new keys)│                                    │
├─────────────────────────────────────────────────────────────┤
│  Data Layer (lib/models/)                                   │
│  Group.ts (updated)    │  Expense.ts (updated)             │
│  RecurringExpense.ts   │  ExpenseComment.ts                │
│  ExchangeRate.ts       │                                    │
├─────────────────────────────────────────────────────────────┤
│  MongoDB (via Mongoose)                                     │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow for Permission-Gated Endpoints

```
Request → verifyAuth() → dbConnect() → load Group doc
       → assertCan(group, userId, permission)
       → business logic → response
```

The `assertCan` call is the single enforcement point for all role-based access. Every mutating API route that touches group data must call it before performing any write.

### Cron Job Flow

```
Vercel Cron (06:00 UTC) → /api/cron/recurring-expenses
  → query RecurringExpense where isActive=true AND nextDueAt <= now
  → for each: create Expense, advance nextDueAt, update counters
  → invalidate cachedBalances on affected groups
  → send notifications to split participants
```

---

## Components and Interfaces

### `lib/group-permissions.ts`

Central permission module. Exports:

```typescript
export type GroupRole = "owner" | "admin" | "member";

export type GroupPermission =
  | "addExpense" | "editAnyExpense" | "deleteAnyExpense" | "editOwnExpense"
  | "inviteMembers" | "removeMember" | "changeRole" | "leaveGroup"
  | "editGroupSettings" | "archiveGroup" | "deleteGroup"
  | "setBudget" | "manageRecurring"
  | "addComment" | "deleteOwnComment" | "deleteAnyComment";

export interface GroupMember {
  user: Types.ObjectId | string;
  role: GroupRole;
  joinedAt: Date;
}

// Permission matrix — static, no DB calls
export const PERMISSION_MATRIX: Record<GroupRole, Set<GroupPermission>>;

export function getUserRole(
  members: GroupMember[],
  userId: string
): GroupRole | null;

export function assertCan(
  members: GroupMember[],
  userId: string,
  permission: GroupPermission
): void; // throws { status: 403, message: string } if denied
```

**Permission matrix design:**

| Permission | owner | admin | member |
|---|---|---|---|
| addExpense | ✓ | ✓ | ✓ |
| editOwnExpense | ✓ | ✓ | ✓ |
| addComment | ✓ | ✓ | ✓ |
| deleteOwnComment | ✓ | ✓ | ✓ |
| leaveGroup | ✓ | ✓ | ✓ |
| editAnyExpense | ✓ | ✓ | — |
| deleteAnyExpense | ✓ | ✓ | — |
| inviteMembers | ✓ | ✓ | — |
| removeMember | ✓ | ✓ | — |
| setBudget | ✓ | ✓ | — |
| manageRecurring | ✓ | ✓ | — |
| deleteAnyComment | ✓ | ✓ | — |
| editGroupSettings | ✓ | ✓ | — |
| archiveGroup | ✓ | — | — |
| changeRole | ✓ | — | — |
| deleteGroup | ✓ | — | — |

### API Route Interfaces

**`PATCH /api/groups/[id]/members`**
```typescript
// Request body
{ userId: string; role: GroupRole }
// Response 200
{ members: GroupMember[] }
// Errors: 400 (last owner), 403 (no changeRole permission), 404 (group/user not found)
```

**`DELETE /api/groups/[id]/members`**
```typescript
// Request body
{ userId: string }
// Response 200
{ members: GroupMember[] }
// Errors: 400 (last owner), 403 (no removeMember permission for others), 404
```

**`POST /api/groups/[id]/archive`**
```typescript
// Request body
{ archiveNote?: string }
// Response 200
{ group: { status, archivedAt, archivedBy, archiveNote }, warning?: string }
// Errors: 403 (no archiveGroup permission)
```

**`DELETE /api/groups/[id]/archive`**
```typescript
// Response 200
{ group: { status: "active" } }
// Errors: 403 (no archiveGroup permission)
```

**`GET /api/groups/[id]/recurring`**
```typescript
// Response 200
{ recurringExpenses: RecurringExpense[] }
```

**`POST /api/groups/[id]/recurring`**
```typescript
// Request body: RecurringExpenseTemplate
// Response 201
{ recurringExpense: RecurringExpense }
// Errors: 400 (invalid amount), 403 (no manageRecurring permission)
```

**`DELETE /api/groups/[id]/recurring/[recurringId]`**
```typescript
// Response 200
{ recurringExpense: { isActive: false } }
// Errors: 403 (no manageRecurring permission)
```

**`GET /api/expenses/[id]/comments`**
```typescript
// Response 200
{ comments: ExpenseComment[] }  // non-deleted, ordered by createdAt asc
```

**`POST /api/expenses/[id]/comments`**
```typescript
// Request body: { text: string }
// Response 201
{ comment: ExpenseComment }
// Errors: 400 (empty/whitespace text)
```

**`DELETE /api/expenses/[id]/comments/[commentId]`**
```typescript
// Response 200
{ comment: { deletedAt: Date } }
// Errors: 403 (not author and no deleteAnyComment permission)
```

**`GET /api/user/consolidate-debts`**
```typescript
// Response 200
{
  consolidatedDebts: Array<{
    userId: string;
    userName: string;
    netCents: number;  // positive = they owe me, negative = I owe them
    groups: Array<{ groupId: string; groupName: string; balanceCents: number }>;
  }>;
  totalOwedToMeCents: number;
  totalIOweCents: number;   // positive number (absolute value)
  groupCount: number;
}
```

**`GET /api/admin/exchange-rates`**
```typescript
// Response 200
{ exchangeRates: ExchangeRate[] }
```

**`POST /api/admin/exchange-rates`**
```typescript
// Request body: { base: string; target: string; rate: number }
// Response 200
{ exchangeRate: ExchangeRate }
// Errors: 400 (rate not positive), 403 (not system admin)
```

### UI Components

**`RecurringExpensesSection`** (`/components/groups/RecurringExpensesSection.tsx`)
- Props: `{ groupId: string; canManage: boolean; currency: string }`
- Uses SWR key `keys.groupRecurring(groupId)`
- Shows skeleton while loading; list of active recurring expenses when loaded
- Each item: description, frequency label (e.g. "Monthly"), nextDueAt formatted date, overdue badge if `nextDueAt < now`
- When `canManage`: "Add" button opens inline form; "Stop" button on each item calls DELETE

**`ConsolidatedDebts`** (`/components/dashboard/ConsolidatedDebts.tsx`)
- Props: none (fetches own data via SWR)
- Uses SWR key `keys.consolidatedDebts()`
- Shows skeleton while loading
- Each row: counterparty name + net balance via `formatMoney(netCents, "USD")`
- Tap/click expands per-group breakdown
- Added below the groups grid in `DashboardOverview.tsx`

**`ExpenseCard` updates** (`/components/ExpenseCard.tsx`)
- New prop: `expenseId: string` (already has `expense._id`)
- Comment toggle button showing count badge
- Expandable comment section using Framer Motion `AnimatePresence`
- Comment input: `text-base` (16px) to prevent iOS zoom
- Enter key submits; Shift+Enter inserts newline
- Uses SWR key `keys.expenseComments(expenseId)` — only fetches when expanded

---

## Data Models

### Updated `lib/models/Group.ts`

```typescript
// New member sub-document
interface IGroupMember {
  user: Types.ObjectId;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
}

// New fields on IGroup
interface IGroup extends Document {
  // ... existing fields ...
  createdBy: Types.ObjectId;  // kept for backwards compatibility (alias for creator)
  members: IGroupMember[];    // replaces flat members array
  status: "active" | "archived";
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  archiveNote?: string;
}
```

Schema changes:
- `members` array element shape: `{ user: ObjectId, role: String enum, joinedAt: Date }`
- `createdBy` field added (mirrors `creator`) for backwards compatibility
- `status` field: `String enum ["active","archived"]`, default `"active"`, indexed
- `archivedAt`, `archivedBy`, `archiveNote` fields added
- Index: `{ "members.user": 1 }` already exists; `{ status: 1 }` added

**Migration script** (`/scripts/migrate-group-roles.ts`):
- Iterates all Group documents
- For each group, rebuilds `members` array: creator gets `role: "owner"`, others get `role: "member"`, `joinedAt` set to group's `createdAt`
- If creator is not in existing members, adds them as owner
- Sets `createdBy` = `creator` on all documents
- Idempotent: skips groups already in role-aware format (detects by checking if first member has a `role` field)

### Updated `lib/models/Expense.ts`

```typescript
// New recurringConfig sub-document
interface IRecurringConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  nextDueAt?: Date;
  endDate?: Date;
  templateId?: Types.ObjectId;  // ref RecurringExpense
  parentId?: Types.ObjectId;    // ref RecurringExpense
  generationCount?: number;
}

// New editHistory entry
interface IEditHistoryEntry {
  editedBy: Types.ObjectId;
  editedAt: Date;
  changes: string[];  // field names that changed
  before: {
    description: string;
    amount: number;   // integer cents
    category: string;
    splits: Array<{ user: Types.ObjectId; amount: number }>;
  };
}

// New fields on IExpense
interface IExpense extends Document {
  // ... existing fields ...
  recurringConfig?: IRecurringConfig;
  editHistory: IEditHistoryEntry[];
}
```

### New `lib/models/RecurringExpense.ts`

```typescript
interface IRecurringExpense extends Document {
  group: Types.ObjectId;
  description: string;
  amount: number;           // integer cents, positive
  category: string;
  paidBy: Types.ObjectId;
  splits: Array<{ user: Types.ObjectId; amount: number }>;  // integer cents
  splitType: "equal" | "percentage" | "exact";
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  startDate: Date;
  endDate?: Date;
  nextDueAt: Date;
  isActive: boolean;        // default true
  pausedAt?: Date;
  generationCount: number;  // default 0
  lastGeneratedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
}
```

Indexes: `{ group: 1, isActive: 1 }`, `{ nextDueAt: 1, isActive: 1 }` (for cron query).

### New `lib/models/ExpenseComment.ts`

```typescript
interface IExpenseComment extends Document {
  expense: Types.ObjectId;
  group: Types.ObjectId;
  author?: Types.ObjectId;    // null for guest comments
  authorName: string;
  isGuest: boolean;           // default false
  guestId?: string;
  text: string;
  editedAt?: Date;
  deletedAt?: Date;           // soft delete
  createdAt: Date;
}
```

Indexes: `{ expense: 1, createdAt: 1 }`, `{ expense: 1, deletedAt: 1 }`.

### New `lib/models/ExchangeRate.ts`

```typescript
interface IExchangeRate extends Document {
  base: string;     // currency code e.g. "USD"
  target: string;   // currency code e.g. "EUR"
  rate: number;     // positive decimal
  source: string;   // e.g. "manual", "openexchangerates"
  fetchedAt: Date;
}
```

Compound index: `{ base: 1, target: 1 }` (unique).

### Updated `lib/money.ts`

New export added (existing functions untouched):

```typescript
/**
 * Convert integer cents from one currency to another using stored ExchangeRate.
 * Returns original cents unchanged if currencies are equal or no rate found.
 * NOTE: This function is async because it may query the database.
 */
export async function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number>;
```

Design decision: `convertCents` is async because it needs to query the `ExchangeRate` collection. It uses `Math.round()` to maintain integer cents invariant. When `fromCurrency === toCurrency`, it short-circuits and returns `cents` immediately without a DB call.

### Updated `lib/swr-keys.ts`

New keys added:

```typescript
groupRecurring: (groupId: string) => `/api/groups/${groupId}/recurring`,
expenseComments: (expenseId: string) => `/api/expenses/${expenseId}/comments`,
consolidatedDebts: () => "/api/user/consolidate-debts",
adminExchangeRates: () => "/api/admin/exchange-rates",
archivedGroups: () => "/api/groups?archived=true",
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: assertCan correctness

*For any* members array, userId, and permission: if the user is not in the members array, `assertCan` must throw a 403 error; if the user is in the members array, `assertCan` must throw a 403 error if and only if `PERMISSION_MATRIX[role]` does not include that permission.

**Validates: Requirements 2.2, 2.4, 2.5**

### Property 2: Last-owner protection

*For any* group with exactly one member holding the `"owner"` role, a DELETE members request targeting that owner must be rejected with HTTP 400, regardless of who is making the request.

**Validates: Requirements 3.5**

### Property 3: Permission enforcement on mutating endpoints

*For any* user whose role does not grant a required permission, the corresponding API endpoint must return HTTP 403. This covers: `changeRole` for PATCH members, `removeMember` for DELETE members (other user), `archiveGroup` for both POST and DELETE archive, `manageRecurring` for both POST and DELETE recurring.

**Validates: Requirements 3.2, 3.4, 6.2, 6.5, 9.3, 9.5**

### Property 4: Archived group expense rejection

*For any* archived group, a POST request to add an expense must be rejected with HTTP 403, regardless of the requesting user's role or the expense payload.

**Validates: Requirements 7.5**

### Property 5: Archive/unarchive round-trip

*For any* active group, archiving it and then immediately restoring it must result in the group having `status: "active"` with `archivedAt`, `archivedBy`, and `archiveNote` all cleared to their null/undefined defaults.

**Validates: Requirements 6.1, 6.4**

### Property 6: Default groups list excludes archived

*For any* set of groups with mixed `status` values, a GET to `/api/groups` without query parameters must return only groups with `status: "active"`.

**Validates: Requirements 7.1**

### Property 7: Recurring expense amount integrity

*For any* RecurringExpense template with a positive integer `amount`, every Expense document generated from that template must have an `amount` field equal to the template's `amount`, and the value must remain a positive integer.

**Validates: Requirements 8.3, 9.6, 10.3**

### Property 8: nextDueAt advancement correctness

*For any* RecurringExpense with a given `frequency` and `nextDueAt`, after one cron generation cycle the new `nextDueAt` must be exactly one frequency-period later than the previous `nextDueAt` (daily → +1 day, weekly → +7 days, biweekly → +14 days, monthly → +1 calendar month).

**Validates: Requirements 10.4**

### Property 9: endDate deactivation

*For any* RecurringExpense where advancing `nextDueAt` by one period would result in a date strictly after `endDate`, the cron job must set `isActive` to `false` rather than advancing `nextDueAt`.

**Validates: Requirements 10.7**

### Property 10: Comment soft-delete exclusion

*For any* expense with any mix of deleted and non-deleted comments, a GET to `/api/expenses/[id]/comments` must return only comments where `deletedAt` is not set, and must never include a comment whose `deletedAt` is set.

**Validates: Requirements 11.2, 11.4**

### Property 11: Comment text validation

*For any* string composed entirely of whitespace characters (spaces, tabs, `\n`, `\r`, or any combination), a POST to `/api/expenses/[id]/comments` with that string as `text` must be rejected with HTTP 400, and no ExpenseComment document must be created.

**Validates: Requirements 11.7**

### Property 12: Edit history append-only with accurate snapshots

*For any* expense that has been edited N times, the `editHistory` array must contain exactly N entries; no prior entry may be modified or removed by a subsequent edit; and each entry's `before` snapshot must exactly match the expense's field values (`description`, `amount`, `category`, `splits`) at the moment immediately before that edit was applied.

**Validates: Requirements 12.2, 12.3, 12.4**

### Property 13: Debt consolidation correctness

*For any* user and any set of active groups, the `netCents` value for each counterparty must equal the algebraic sum of that counterparty's per-group balances (positive when they owe the user, negative when the user owes them); `totalOwedToMeCents` must equal the sum of all positive `netCents` values; `totalIOweCents` must equal the absolute value of the sum of all negative `netCents` values; and no guest counterparty may appear in `consolidatedDebts`.

**Validates: Requirements 13.2, 13.3, 13.4**

### Property 14: convertCents correctness

*For any* integer cents value and any currency codes: (a) `convertCents(cents, c, c)` must return the original `cents` value unchanged for any currency `c`; and (b) for any positive exchange rate, `convertCents` must return an integer (no fractional cents).

**Validates: Requirements 16.1, 16.2**

---

## Error Handling

### Permission Errors (403)
All `assertCan` failures return `{ success: false, error: "Forbidden: insufficient permissions" }` with HTTP 403. The error message does not reveal the permission matrix to clients.

### Validation Errors (400)
- Non-integer or non-positive `amount` on recurring expense creation
- Empty/whitespace `text` on comment creation
- Non-positive `rate` on exchange rate upsert
- Removing last owner from a group

### Not Found (404)
Group, expense, comment, or recurring expense not found returns `{ success: false, error: "Not found" }` with HTTP 404.

### Archived Group (403)
Attempting to add an expense to an archived group returns `{ success: false, error: "Cannot add expenses to an archived group" }` with HTTP 403.

### Cron Job Errors
The cron handler wraps each individual recurring expense generation in a try/catch. A failure on one template does not abort processing of the remaining templates. Errors are logged via `logError` and the cron returns a summary `{ processed: N, failed: M }`.

### Currency Conversion Fallback
When `convertCents` cannot find an exchange rate, it logs a warning via `console.warn` and returns the original cents value unchanged. This is a graceful degradation — the UI will display amounts in their original currency rather than crashing.

### Migration Script Errors
The migration script logs each group it processes and any errors encountered. It is idempotent: re-running it on already-migrated groups is safe (detected by presence of `role` field on member objects).

---

## Testing Strategy

### Unit Tests (example-based)

Focus on specific behaviors and edge cases:

- `getUserRole` returns correct role for each member type
- `getUserRole` returns `null` for non-members
- `assertCan` throws for every permission when user is not a member
- `assertCan` does not throw for valid role/permission combinations
- `convertCents` returns original value when currencies are equal
- `convertCents` returns integer when rate produces fractional result
- Migration script correctly assigns owner role to creator
- Migration script adds creator as owner when not in members array
- `nextDueAt` advancement for each frequency (daily, weekly, biweekly, monthly)
- Comment GET excludes soft-deleted comments
- Debt consolidation correctly sums per-counterparty across groups

### Property-Based Tests (fast-check)

The project uses [fast-check](https://fast-check.io/) for property-based testing. Each property test runs a minimum of 100 iterations.

**Tag format:** `Feature: advanced-group-features, Property {N}: {property_text}`

**Property 1 — assertCan correctness**
Generate: random members array (valid roles), random userId (in array or not), random permission
Assert: if userId not in array → always throws; if userId in array → throws iff `PERMISSION_MATRIX[role]` excludes that permission

**Property 2 — Last-owner protection**
Generate: group with exactly one owner (may have other members with any role), DELETE request targeting that owner
Assert: API returns HTTP 400

**Property 3 — Permission enforcement on mutating endpoints**
Generate: random members array where requesting user's role lacks the required permission (changeRole / removeMember / archiveGroup / manageRecurring)
Assert: corresponding API endpoint returns HTTP 403

**Property 4 — Archived group expense rejection**
Generate: archived group, random valid expense payload, random member role for requesting user
Assert: POST to add expense always returns HTTP 403

**Property 5 — Archive/unarchive round-trip**
Generate: active group with random name, currency, and member composition
Assert: after archive then restore, `status === "active"` and `archivedAt`, `archivedBy`, `archiveNote` are all cleared

**Property 6 — Default groups list excludes archived**
Generate: random set of groups with mixed `status` values
Assert: GET `/api/groups` (no params) returns only groups with `status === "active"`

**Property 7 — Recurring expense amount integrity**
Generate: random positive integer `amount`, random frequency, random splits summing to `amount`
Assert: generated Expense `amount === template.amount`; all split amounts are integers

**Property 8 — nextDueAt advancement correctness**
Generate: random `nextDueAt` date, random `frequency` from the allowed set
Assert: advanced date is exactly one period later (daily +1d, weekly +7d, biweekly +14d, monthly +1 calendar month)

**Property 9 — endDate deactivation**
Generate: RecurringExpense where `nextDueAt + 1 period > endDate`
Assert: after cron processing, `isActive === false`

**Property 10 — Comment soft-delete exclusion**
Generate: random list of comments, random subset with `deletedAt` set
Assert: GET response contains only comments where `deletedAt` is not set

**Property 11 — Comment text validation**
Generate: strings composed entirely of whitespace characters (spaces, tabs, `\n`, `\r`, combinations)
Assert: POST returns HTTP 400, no ExpenseComment document created

**Property 12 — Edit history append-only with accurate snapshots**
Generate: expense with random field values, sequence of N random updates
Assert: `editHistory.length === N`; no prior entry is mutated; each `before` snapshot matches the pre-update field values

**Property 13 — Debt consolidation correctness**
Generate: random multi-group balance scenarios with a mix of registered users and guests
Assert: `netCents` sign is correct; `totalOwedToMeCents === sum of positive netCents`; `totalIOweCents === |sum of negative netCents|`; no guest in `consolidatedDebts`

**Property 14 — convertCents correctness**
Generate: random integer cents, random currency codes, random positive exchange rates
Assert: `convertCents(cents, c, c) === cents` for any currency `c`; output is always an integer for any positive rate

### Integration Tests

- Cron endpoint processes due recurring expenses end-to-end (with test DB)
- Member management API correctly updates MongoDB documents
- Archive API correctly sets/clears archive fields in MongoDB
- Exchange rate upsert creates new record or updates existing one
- Consolidation API returns correct aggregated balances from real group data

### Mobile Rendering

All new UI components must be manually verified at 390px viewport width:
- `RecurringExpensesSection`: list items wrap correctly, action buttons remain tappable (min 44px)
- `ConsolidatedDebts`: counterparty rows readable, expanded breakdown fits viewport
- `ExpenseCard` comment section: input at 16px font size, comment list scrollable
- Admin exchange rates page: table scrolls horizontally or stacks on mobile
