# Requirements Document

## Introduction

SplitEasy Phase 12 adds advanced group management features for real-world long-term use cases. This phase introduces role-based group permissions, group archiving, recurring expenses, expense comments, expense edit history, cross-group debt consolidation, and multi-currency exchange rate management. All monetary values are stored as integer cents and displayed using `formatMoney(cents, currency)`. Every feature must be fully functional on mobile viewports (390px minimum width).

## Glossary

- **Group**: A shared expense-tracking space with one or more members.
- **Owner**: The highest-privilege group role; exactly one per group; can perform all actions including deleting the group.
- **Admin**: A group role with elevated privileges; can manage members, recurring expenses, and moderate comments.
- **Member**: The default group role; can add expenses and comments but cannot manage group settings.
- **GroupRole**: One of `"owner"`, `"admin"`, or `"member"`.
- **Permission**: A named capability (e.g., `addExpense`, `archiveGroup`) that is granted or denied based on a member's GroupRole.
- **Permission_Matrix**: The static mapping from GroupRole to the set of Permissions that role is granted.
- **RecurringExpense**: A template that automatically generates Expense documents on a defined schedule.
- **Frequency**: The recurrence interval for a RecurringExpense — one of `daily`, `weekly`, `biweekly`, or `monthly`.
- **ExpenseComment**: A text comment attached to a specific Expense, authored by a group member or guest.
- **EditHistory**: An append-only log of changes made to an Expense, stored on the Expense document.
- **ConsolidatedDebt**: An aggregated net balance between the current user and a single counterparty across all active groups.
- **ExchangeRate**: A stored conversion rate between two currencies, used by `convertCents()`.
- **Archive**: The act of marking a Group as inactive (`status: "archived"`) while preserving all its data.
- **Cron_Job**: A scheduled server-side task executed at a fixed time interval via Vercel cron.
- **Cents**: Integer representation of a monetary amount (e.g., $3.00 = 300 cents).
- **Permission_Utility**: The module at `/lib/group-permissions.ts` that exposes `getUserRole()`, `assertCan()`, and the Permission_Matrix.
- **Balance_Cache**: The `cachedBalances` field on a Group document, invalidated when expenses change.
- **SWR**: The client-side data-fetching library used for cache invalidation and revalidation.

---

## Requirements

### Requirement 1: Group Role Schema

**User Story:** As a group owner, I want members to have defined roles, so that I can control who can perform sensitive actions in my group.

#### Acceptance Criteria

1. THE Group_Schema SHALL store each member as an object with fields `user` (ObjectId ref User), `role` (one of `"owner"`, `"admin"`, `"member"`), and `joinedAt` (Date).
2. THE Group_Schema SHALL retain the `createdBy` field for backwards compatibility with existing data.
3. THE Migration_Script at `/scripts/migrate-group-roles.ts` SHALL convert all existing flat `members[]` arrays to the role-aware structure, assigning `"owner"` to the group creator and `"member"` to all other members.
4. WHEN the Migration_Script runs, THE Migration_Script SHALL set `joinedAt` to the group's `createdAt` date for all migrated members.
5. IF the Migration_Script encounters a group where the creator is not in the members array, THEN THE Migration_Script SHALL add the creator as an `"owner"` member.

---

### Requirement 2: Permission Utility

**User Story:** As a developer, I want a centralized permission utility, so that all API routes enforce consistent role-based access control.

#### Acceptance Criteria

1. THE Permission_Utility SHALL export a `GroupRole` type defined as `"owner" | "admin" | "member"`.
2. THE Permission_Matrix SHALL define which roles are granted each of the following permissions: `addExpense`, `editAnyExpense`, `deleteAnyExpense`, `editOwnExpense`, `inviteMembers`, `removeMember`, `changeRole`, `leaveGroup`, `editGroupSettings`, `archiveGroup`, `deleteGroup`, `setBudget`, `manageRecurring`, `addComment`, `deleteOwnComment`, `deleteAnyComment`.
3. THE Permission_Utility SHALL export a `getUserRole(group, userId)` function that returns the GroupRole of the given user in the given group, or `null` if the user is not a member.
4. THE Permission_Utility SHALL export an `assertCan(group, userId, permission)` function that throws an error with HTTP status 403 WHEN the user does not have the specified permission.
5. WHEN `assertCan` is called for a user who is not a member of the group, THE Permission_Utility SHALL throw a 403 error.

---

### Requirement 3: Member Management API

**User Story:** As a group owner or admin, I want to manage group membership and roles via API, so that I can control who belongs to the group and what they can do.

#### Acceptance Criteria

1. WHEN a PATCH request is sent to `/api/groups/[id]/members` with a `userId` and `role`, THE Members_API SHALL update that member's role in the group.
2. WHEN a PATCH request to change a member's role is received, THE Members_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the `changeRole` permission.
3. WHEN a DELETE request is sent to `/api/groups/[id]/members` with a `userId` matching the requesting user, THE Members_API SHALL remove that user from the group (self-leave).
4. WHEN a DELETE request is sent to `/api/groups/[id]/members` with a `userId` different from the requesting user, THE Members_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the `removeMember` permission.
5. IF a DELETE request would remove the last Owner from a group, THEN THE Members_API SHALL reject the request with HTTP 400 and a descriptive error message.
6. WHEN a member is successfully removed, THE Members_API SHALL return HTTP 200 with the updated member list.

---

### Requirement 4: Updated Group Membership Queries

**User Story:** As a developer, I want all group queries to use the role-aware member structure, so that membership checks and data population work correctly after the schema migration.

#### Acceptance Criteria

1. THE Group_API SHALL use `"members.user": userId` (not `members: userId`) for all membership filter queries.
2. THE Group_API SHALL use `populate("members.user")` (not `populate("members")`) for all member population queries.
3. WHEN a group is returned from any API endpoint, THE Group_API SHALL include each member's `role` and `joinedAt` fields in the response.

---

### Requirement 5: Group Archive Schema

**User Story:** As a group owner, I want to archive completed groups (e.g., a trip), so that they are hidden from my active groups list but their data is preserved.

#### Acceptance Criteria

1. THE Group_Schema SHALL include a `status` field with values `"active"` or `"archived"`, defaulting to `"active"`, with a database index.
2. THE Group_Schema SHALL include `archivedAt` (Date), `archivedBy` (ObjectId ref User), and `archiveNote` (String) fields.

---

### Requirement 6: Group Archive API

**User Story:** As a group owner, I want to archive and restore groups via API, so that I can manage the lifecycle of my groups.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/groups/[id]/archive`, THE Archive_API SHALL set the group's `status` to `"archived"`, record `archivedAt`, `archivedBy`, and the optional `archiveNote`.
2. WHEN a POST request to archive a group is received, THE Archive_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the `archiveGroup` permission.
3. WHEN a group has pending unsettled balances and a POST archive request is received, THE Archive_API SHALL include a warning in the response but still complete the archive operation.
4. WHEN a DELETE request is sent to `/api/groups/[id]/archive`, THE Archive_API SHALL restore the group by setting `status` back to `"active"` and clearing `archivedAt`, `archivedBy`, and `archiveNote`.
5. WHEN a DELETE request to restore a group is received, THE Archive_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the `archiveGroup` permission.

---

### Requirement 7: Archived Group Filtering

**User Story:** As a user, I want archived groups hidden from my default groups list, so that my active view stays uncluttered.

#### Acceptance Criteria

1. WHEN a GET request is sent to `/api/groups` without query parameters, THE Groups_API SHALL exclude groups with `status: "archived"` from the response.
2. WHEN a GET request is sent to `/api/groups?archived=true`, THE Groups_API SHALL include archived groups in the response.
3. THE Groups_List_Page SHALL display a "Show archived" toggle that, when enabled, fetches and displays archived groups.
4. WHEN an archived group card is displayed, THE Groups_List_Page SHALL render a visual indicator (e.g., badge or muted styling) to distinguish it from active groups.
5. WHEN a POST request to add an expense is received for an archived group, THE Expense_API SHALL reject the request with HTTP 403 and a message indicating the group is archived.

---

### Requirement 8: Recurring Expense Schema

**User Story:** As a group admin, I want to define recurring expenses, so that regular shared costs (e.g., monthly rent) are automatically tracked.

#### Acceptance Criteria

1. THE RecurringExpense_Model SHALL store: `group` (ObjectId), `description` (String), `amount` (Cents integer), `category` (String), `paidBy` (ObjectId), `splits` (array of user/amount pairs in Cents), `splitType` (equal/percentage/exact), `frequency` (daily/weekly/biweekly/monthly), `startDate` (Date), `endDate` (Date, optional), `nextDueAt` (Date), `isActive` (Boolean, default true), `pausedAt` (Date, optional), `generationCount` (Number, default 0), `lastGeneratedAt` (Date, optional).
2. THE Expense_Schema SHALL include a `recurringConfig` sub-document with fields: `enabled` (Boolean), `frequency` (daily/weekly/biweekly/monthly), `nextDueAt` (Date), `endDate` (Date, optional), `templateId` (ObjectId ref RecurringExpense), `parentId` (ObjectId ref RecurringExpense), `generationCount` (Number).
3. THE RecurringExpense_Model SHALL enforce that `amount` is a positive integer (Cents).

---

### Requirement 9: Recurring Expense CRUD API

**User Story:** As a group admin, I want to create, list, and stop recurring expenses via API, so that I can manage automated expense generation.

#### Acceptance Criteria

1. WHEN a GET request is sent to `/api/groups/[id]/recurring`, THE Recurring_API SHALL return all active RecurringExpense documents for that group.
2. WHEN a POST request is sent to `/api/groups/[id]/recurring` with valid template data, THE Recurring_API SHALL create a new RecurringExpense document and return it with HTTP 201.
3. WHEN a POST request to create a recurring expense is received, THE Recurring_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the `manageRecurring` permission.
4. WHEN a DELETE request is sent to `/api/groups/[id]/recurring/[recurringId]`, THE Recurring_API SHALL set `isActive` to `false` on the RecurringExpense document.
5. WHEN a DELETE request to stop a recurring expense is received, THE Recurring_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the `manageRecurring` permission.
6. WHEN a POST request contains an `amount` that is not a positive integer, THE Recurring_API SHALL reject the request with HTTP 400.

---

### Requirement 10: Recurring Expense Cron Job

**User Story:** As a user, I want recurring expenses to be automatically created on schedule, so that I don't have to manually add them each period.

#### Acceptance Criteria

1. THE Cron_Job at `/api/cron/recurring-expenses` SHALL run daily at 06:00 UTC as defined in `vercel.json`.
2. WHEN the Cron_Job runs, THE Cron_Job SHALL query all RecurringExpense documents where `isActive` is `true` and `nextDueAt` is less than or equal to the current time.
3. WHEN a due RecurringExpense is found, THE Cron_Job SHALL create a new Expense document using the template's `description`, `amount`, `category`, `paidBy`, `splits`, and `splitType` fields.
4. WHEN a new Expense is created from a template, THE Cron_Job SHALL advance `nextDueAt` on the RecurringExpense to the next occurrence based on `frequency`.
5. WHEN a new Expense is created from a template, THE Cron_Job SHALL increment `generationCount` and update `lastGeneratedAt` on the RecurringExpense.
6. WHEN a new Expense is created from a template, THE Cron_Job SHALL invalidate the Balance_Cache for the affected group.
7. WHEN a RecurringExpense has an `endDate` and `nextDueAt` would advance past `endDate`, THE Cron_Job SHALL set `isActive` to `false` instead of advancing `nextDueAt`.
8. WHEN a new Expense is created from a template, THE Cron_Job SHALL send notifications to all split participants.

---

### Requirement 11: Expense Comments Model and API

**User Story:** As a group member, I want to add comments to expenses, so that I can provide context or ask questions about specific charges.

#### Acceptance Criteria

1. THE ExpenseComment_Model SHALL store: `expense` (ObjectId ref Expense), `group` (ObjectId ref Group), `author` (ObjectId ref User, optional), `authorName` (String), `isGuest` (Boolean, default false), `guestId` (String, optional), `text` (String, required), `editedAt` (Date, optional), `deletedAt` (Date, optional, for soft delete), `createdAt` (Date).
2. WHEN a GET request is sent to `/api/expenses/[id]/comments`, THE Comments_API SHALL return all non-deleted comments for that expense, ordered by `createdAt` ascending.
3. WHEN a POST request is sent to `/api/expenses/[id]/comments` with a non-empty `text`, THE Comments_API SHALL create a new ExpenseComment and return it with HTTP 201.
4. WHEN a DELETE request is sent to `/api/expenses/[id]/comments/[commentId]`, THE Comments_API SHALL soft-delete the comment by setting `deletedAt` to the current time.
5. WHEN a DELETE request to remove a comment is received, THE Comments_API SHALL reject the request with HTTP 403 UNLESS the requesting user is the comment author OR has the `deleteAnyComment` permission.
6. WHEN a comment is added by a user who is not the expense payer, THE Comments_API SHALL send a notification to the expense payer.
7. WHEN a POST request contains an empty or whitespace-only `text`, THE Comments_API SHALL reject the request with HTTP 400.

---

### Requirement 12: Expense Edit History

**User Story:** As a group member, I want to see the edit history of an expense, so that I can understand what changed and when.

#### Acceptance Criteria

1. THE Expense_Schema SHALL include an `editHistory` array where each entry stores: `editedBy` (ObjectId ref User), `editedAt` (Date), `changes` (array of field name strings), and a `before` snapshot containing `description`, `amount`, `category`, and `splits`.
2. WHEN a PUT request is received at `/api/groups/[id]/expenses/[expenseId]`, THE Expense_API SHALL capture a snapshot of the current `description`, `amount`, `category`, and `splits` values before applying the update.
3. WHEN an expense is successfully updated, THE Expense_API SHALL append a new entry to `editHistory` containing the `before` snapshot, the list of changed field names, the `editedBy` user ID, and the current timestamp as `editedAt`.
4. THE Expense_API SHALL preserve all previous `editHistory` entries when a new edit is recorded.

---

### Requirement 13: Cross-Group Debt Consolidation API

**User Story:** As a user, I want to see my net balance with each person across all my groups, so that I can understand my total financial position without checking each group individually.

#### Acceptance Criteria

1. WHEN a GET request is sent to `/api/user/consolidate-debts`, THE Consolidation_API SHALL aggregate balances across all active groups where the requesting user is a member.
2. THE Consolidation_API SHALL group results by counterparty user ID, computing a `netCents` value where positive means the counterparty owes the requesting user and negative means the requesting user owes the counterparty.
3. THE Consolidation_API SHALL exclude guest counterparties from the consolidated results.
4. THE Consolidation_API SHALL return a response containing: `consolidatedDebts[]` (array of counterparty objects with `userId`, `userName`, `netCents`, and `groups[]`), `totalOwedToMeCents` (sum of positive netCents), `totalIOweCents` (sum of negative netCents as a positive number), and `groupCount` (number of active groups included).
5. WHEN a counterparty appears in multiple groups, THE Consolidation_API SHALL include a `groups[]` array on that counterparty entry listing each group name and the per-group balance in Cents.

---

### Requirement 14: Consolidated Debts UI Component

**User Story:** As a user, I want to see my cross-group debt summary on the dashboard, so that I have an at-a-glance view of my overall financial position.

#### Acceptance Criteria

1. THE ConsolidatedDebts_Component at `/components/dashboard/ConsolidatedDebts.tsx` SHALL display each counterparty's name and net balance using `formatMoney(netCents, currency)`.
2. THE ConsolidatedDebts_Component SHALL be added to `DashboardOverview.tsx` below the groups grid.
3. WHEN a counterparty row is tapped or clicked, THE ConsolidatedDebts_Component SHALL expand to show the per-group breakdown of that debt.
4. THE ConsolidatedDebts_Component SHALL display a loading skeleton while data is being fetched.
5. THE ConsolidatedDebts_Component SHALL render correctly on a 390px wide mobile viewport.

---

### Requirement 15: Exchange Rate Model

**User Story:** As a developer, I want exchange rates stored in the database, so that multi-currency groups can convert amounts for display and consolidation.

#### Acceptance Criteria

1. THE ExchangeRate_Model at `/lib/models/ExchangeRate.ts` SHALL store: `base` (String, currency code), `target` (String, currency code), `rate` (Number, positive), `source` (String), `fetchedAt` (Date).
2. THE ExchangeRate_Model SHALL have a compound index on `base` and `target` to support efficient lookups.

---

### Requirement 16: Currency Conversion Utility

**User Story:** As a developer, I want a `convertCents` function in `lib/money.ts`, so that monetary amounts can be converted between currencies using stored exchange rates.

#### Acceptance Criteria

1. THE Money_Utility SHALL export a `convertCents(cents, fromCurrency, toCurrency)` function that returns the converted amount as an integer in Cents.
2. WHEN `fromCurrency` equals `toCurrency`, THE Money_Utility SHALL return the original `cents` value unchanged.
3. WHEN an ExchangeRate record exists for the given currency pair, THE Money_Utility SHALL use that rate to compute the converted Cents value.
4. IF no ExchangeRate record is found for the given currency pair, THEN THE Money_Utility SHALL return the original `cents` value unchanged and log a warning.
5. THE `formatMoney` function in `lib/money.ts` SHALL remain unchanged.

---

### Requirement 17: Exchange Rate Management API

**User Story:** As an admin, I want to manage exchange rates via API, so that the system has up-to-date conversion rates for multi-currency groups.

#### Acceptance Criteria

1. WHEN a GET request is sent to `/api/admin/exchange-rates`, THE ExchangeRate_API SHALL return all stored ExchangeRate records.
2. WHEN a POST request is sent to `/api/admin/exchange-rates` with `base`, `target`, and `rate` fields, THE ExchangeRate_API SHALL upsert the ExchangeRate record for that currency pair.
3. WHEN a request is received at `/api/admin/exchange-rates`, THE ExchangeRate_API SHALL reject the request with HTTP 403 UNLESS the requesting user has the system-level admin role.
4. WHEN a POST request contains a `rate` that is not a positive number, THE ExchangeRate_API SHALL reject the request with HTTP 400.

---

### Requirement 18: Admin Exchange Rates Panel

**User Story:** As an admin, I want an exchange rates management page in the admin panel, so that I can view and update currency conversion rates through the UI.

#### Acceptance Criteria

1. THE Admin_Panel SHALL include an "Exchange Rates" entry in the admin sidebar navigation.
2. THE Exchange_Rates_Page at `/app/admin/exchange-rates/page.tsx` SHALL display a table of all stored ExchangeRate records showing `base`, `target`, `rate`, and `fetchedAt`.
3. THE Exchange_Rates_Page SHALL include an inline edit form that allows an admin to update the `rate` for an existing currency pair or add a new pair.
4. THE Exchange_Rates_Page SHALL render correctly on a 390px wide mobile viewport.

---

### Requirement 19: Recurring Expenses UI Section

**User Story:** As a group member, I want to see and manage recurring expenses in the group detail view, so that I know what automated charges are active.

#### Acceptance Criteria

1. THE RecurringExpensesSection_Component at `/components/groups/RecurringExpensesSection.tsx` SHALL display a list of active RecurringExpense documents for the group, showing `description`, `frequency` label, and `nextDueAt` date.
2. WHEN a RecurringExpense's `nextDueAt` is in the past, THE RecurringExpensesSection_Component SHALL display an overdue indicator on that item.
3. WHERE the `canManage` prop is `true`, THE RecurringExpensesSection_Component SHALL display "Add" and "Stop" action buttons.
4. THE RecurringExpensesSection_Component SHALL display skeleton loading states while data is being fetched.
5. THE RecurringExpensesSection_Component SHALL be added to the group detail page's right panel.
6. THE RecurringExpensesSection_Component SHALL render correctly on a 390px wide mobile viewport.

---

### Requirement 20: Expense Comment UI

**User Story:** As a group member, I want to view and post comments on expense cards, so that I can discuss specific expenses inline.

#### Acceptance Criteria

1. THE ExpenseCard_Component SHALL display a comment toggle that shows the number of non-deleted comments for that expense.
2. WHEN the comment toggle is activated, THE ExpenseCard_Component SHALL expand to show the comment list and a new comment input field.
3. THE ExpenseCard_Component SHALL display each comment with the author's name and comment text.
4. THE ExpenseCard_Component SHALL use a `font-size` of at least `16px` (text-base) on the comment input to prevent automatic zoom on iOS devices.
5. WHEN the user presses the Enter key in the comment input, THE ExpenseCard_Component SHALL submit the new comment.
6. THE ExpenseCard_Component SHALL render the comment section correctly on a 390px wide mobile viewport.

---

### Requirement 21: Vercel Cron Configuration

**User Story:** As a developer, I want the recurring expenses cron job registered in `vercel.json`, so that it runs automatically on the Vercel platform.

#### Acceptance Criteria

1. THE `vercel.json` file SHALL include a cron entry for `/api/cron/recurring-expenses` with the schedule `"0 6 * * *"` (daily at 06:00 UTC).
2. THE `vercel.json` file SHALL retain all existing cron entries (`invite-expiry`, `invite-expiring`, `budget-alerts`) unchanged.
