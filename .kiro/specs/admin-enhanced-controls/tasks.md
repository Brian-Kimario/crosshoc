# Implementation Plan: Admin Enhanced Controls

## Overview

Extend the SplitEasy admin panel with seven write-capable API routes, two schema changes, and balance calculation updates. All routes follow the established pattern: `requireAdmin()` → `dbConnect()` → business logic → fire-and-forget `logAction()` / `notify()` / `invalidateBalanceCache()`. The design document's 13 correctness properties are covered by property-based tests using **fast-check**.

## Tasks

- [x] 1. Schema changes — Expense, Settlement, AuditLog models
  - [x] 1.1 Add `isVoided` and `voidedAt` fields to the Expense model
    - Add `isVoided?: boolean` (default `false`, indexed) and `voidedAt?: Date` (default `null`) to `IExpense` interface in `lib/models/Expense.ts`
    - Add corresponding schema fields with `index: true` on `isVoided`
    - _Requirements: 2.1_

  - [x] 1.2 Extend `SettlementStatus` to include `"voided"` in the Settlement model
    - Update `SettlementStatus` type union in `lib/models/Settlement.ts` to add `"voided"`
    - Update the schema `enum` array for the `status` field to include `"voided"`
    - _Requirements: 5.1_

  - [x] 1.3 Extend `AuditAction` with six new action strings in the AuditLog model
    - Add `"expense.admin_voided"`, `"member.admin_removed"`, `"group.admin_deleted"`, `"settlement.admin_voided"`, `"user.admin_profile_updated"`, `"user.admin_password_reset_triggered"` to the `AuditAction` type union in `lib/models/AuditLog.ts`
    - Update the schema `enum` array to match
    - _Requirements: 8.1_

- [x] 2. Balance calculation — filter voided expenses and settlements
  - [x] 2.1 Update `calculateGroupBalances` in `lib/balance-server.ts` to exclude voided expenses
    - Add `{ isVoided: { $ne: true } }` to the `Expense.find()` query
    - _Requirements: 2.2 (implicit: voided expenses must not affect balances)_

  - [x] 2.2 Update `calculateGroupBalances` to exclude voided settlements
    - Change the `Settlement.find()` query from `{ group: groupId, status: "confirmed" }` to `{ group: groupId, status: "confirmed" }` — voided settlements already excluded because only `"confirmed"` is fetched; verify this is correct and add a comment confirming `"voided"` is intentionally excluded
    - _Requirements: 5.2 (implicit: voided settlements must not affect balances)_

  - [x] 2.3 Write unit tests for balance calculation exclusion
    - Test that an expense with `isVoided: true` is not counted in balances
    - Test that a settlement with `status: "voided"` is not counted in balances
    - _Requirements: 2.2, 5.2_

- [ ] 3. Checkpoint — verify schema and balance changes compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Group detail API route — `GET /api/admin/groups/[groupId]`
  - [x] 4.1 Create `app/api/admin/groups/[groupId]/route.ts` with the `GET` handler
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Parse `expensePage` and `settlementPage` query params (default 1, limit 50)
    - Fetch the Group document; return 404 if not found
    - Fetch paginated expenses for the group (populate `paidBy` name)
    - Fetch paginated settlements for the group (populate `fromUser` and `toUser` names)
    - Call `getGroupBalances(groupId)` from `@/lib/balance-cache` for member balances
    - Return the combined response shape defined in the design document
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 4.2 Write unit tests for group detail route
    - Test 404 when group does not exist
    - Test 401 when not admin
    - Test pagination defaults and boundary values
    - _Requirements: 1.5, 1.6, 1.7, 1.8_

- [x] 5. Void expense API route — `POST /api/admin/expenses/[expenseId]/void`
  - [x] 5.1 Create `app/api/admin/expenses/[expenseId]/void/route.ts` with the `POST` handler
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Parse and validate `reason` from request body; return 400 if absent, empty, or whitespace-only
    - Fetch the Expense document; return 404 if not found
    - Return 409 if `expense.isVoided === true`
    - Set `isVoided: true` and `voidedAt: new Date()` and save
    - Fire-and-forget: call `invalidateBalanceCache(expense.group.toString())` from `@/lib/balance-cache`
    - Fire-and-forget: call `logAction()` with action `"expense.admin_voided"`, `before` = `{ description, amount, groupId, splits }`, `after` = `{ reason, voidedAt }`, `groupId`, `resourceId`
    - Fire-and-forget: call `notify()` for every user in `expense.splits` with a message that the expense was voided by an admin
    - Return `{ success: true, voidedAt }` on success
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 8.2, 8.3, 8.4_

  - [x] 5.2 Write property test for void expense — Property 1: Void expense sets correct fields
    - **Property 1: Void expense sets correct fields**
    - **Validates: Requirements 2.1**
    - Use `fc.record({ description: fc.string(), amount: fc.integer({ min: 1 }) })` to generate expense data
    - Assert `isVoided === true && voidedAt instanceof Date` after void operation

  - [x] 5.3 Write property test for void expense — Property 2: Void expense notifies all split members
    - **Property 2: Void expense notifies all split members**
    - **Validates: Requirements 2.4**
    - Use `fc.array(fc.string(), { minLength: 1, maxLength: 10 })` for split user IDs
    - Assert `notifyCalls.length === splits.length`

  - [x] 5.4 Write property test for reason validation — Property 3: Empty/whitespace reason is always rejected
    - **Property 3: Empty/whitespace reason is always rejected for destructive actions**
    - **Validates: Requirements 2.5, 3.5, 4.4, 5.5**
    - Use `fc.string()` filtered to whitespace-only, empty, and absent values
    - Assert HTTP 400 and document unchanged for void expense, remove member, delete group, void settlement

- [x] 6. Remove member API route — `DELETE /api/admin/groups/[groupId]/members/[userId]`
  - [x] 6.1 Create `app/api/admin/groups/[groupId]/members/[userId]/route.ts` with the `DELETE` handler
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Parse and validate `reason` from request body; return 400 if absent, empty, or whitespace-only
    - Fetch the Group document; return 404 if group not found
    - Check that the target userId exists in `group.members[]`; return 404 if not found
    - Remove the member entry using `$pull` on `Group.members`
    - Fire-and-forget: call `invalidateBalanceCache(groupId)` from `@/lib/balance-cache`
    - Fire-and-forget: call `logAction()` with action `"member.admin_removed"`, `before` = `{ userId, name }`, `after` = `{ reason, groupId }`, `groupId`, `resourceId`
    - Fire-and-forget: call `notify()` for the removed user informing them they were removed by an admin
    - Return `{ success: true }` on success
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 8.2, 8.3, 8.4_

  - [x] 6.2 Write property test for remove member — Property 4: Remove member removes exactly that member
    - **Property 4: Remove member removes exactly that member**
    - **Validates: Requirements 3.1**
    - Use `fc.array(fc.string(), { minLength: 2, maxLength: 10 })` for member IDs, pick one to remove
    - Assert removed member absent from `Group.members[]` and all others still present

  - [x] 6.3 Write unit tests for remove member route
    - Test 404 when group does not exist
    - Test 404 when user is not a member of the group
    - Test 401 when not admin
    - _Requirements: 3.6, 3.7, 3.8_

- [x] 7. Delete group API route — `DELETE /api/admin/groups/[groupId]`
  - [x] 7.1 Add the `DELETE` handler to `app/api/admin/groups/[groupId]/route.ts`
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Parse and validate `reason` from request body; return 400 if absent, empty, or whitespace-only
    - Fetch the Group document (with members populated for notification); return 404 if not found
    - Count associated Expense and Settlement documents before deletion
    - Delete the Group document, all Expense documents with `group: groupId`, and all Settlement documents with `group: groupId`
    - Fire-and-forget: call `logAction()` with action `"group.admin_deleted"`, `before` = `{ name, memberCount, expenseCount, settlementCount }`, `after` = `{ reason }`, `resourceId`
    - Fire-and-forget: call `notify()` for every user who was a member at deletion time
    - Return `{ success: true, deletedExpenses, deletedSettlements }` on success
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.2, 8.4_

  - [x] 7.2 Write property test for delete group — Property 5: Delete group removes all associated documents
    - **Property 5: Delete group removes all associated documents**
    - **Validates: Requirements 4.1**
    - Use `fc.integer({ min: 0, max: 20 })` for expense count and `fc.integer({ min: 0, max: 10 })` for settlement count
    - Assert Group, all Expenses, and all Settlements for that groupId do not exist after deletion

  - [x] 7.3 Write property test for delete group — Property 6: Delete group notifies all members
    - **Property 6: Delete group notifies all members**
    - **Validates: Requirements 4.3**
    - Use `fc.array(fc.string(), { minLength: 1, maxLength: 10 })` for member IDs
    - Assert `notifyCalls.length === members.length`

  - [x] 7.4 Write unit tests for delete group route
    - Test 404 when group does not exist
    - Test 400 when reason is missing
    - Test 401 when not admin
    - _Requirements: 4.4, 4.5, 4.6_

- [ ] 8. Checkpoint — verify group routes compile and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Void settlement API route — `POST /api/admin/settlements/[settlementId]/void`
  - [x] 9.1 Create `app/api/admin/settlements/[settlementId]/void/route.ts` with the `POST` handler
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Parse and validate `reason` from request body; return 400 if absent, empty, or whitespace-only
    - Fetch the Settlement document; return 404 if not found
    - Return 409 if `settlement.status === "voided"`
    - Set `status: "voided"`, `adminNote: reason`, `resolvedByAdmin: session.userId`, `resolvedAt: new Date()` and save
    - Fire-and-forget: call `invalidateBalanceCache(settlement.group.toString())` from `@/lib/balance-cache`
    - Fire-and-forget: call `logAction()` with action `"settlement.admin_voided"`, `before` = `{ status, amount, fromUser, toUser }`, `after` = `{ reason }`, `groupId`, `resourceId`
    - Fire-and-forget: call `notify()` for both `fromUser` and `toUser`
    - Return `{ success: true }` on success
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 8.2, 8.3, 8.4_

  - [x] 9.2 Write property test for void settlement — Property 7: Void settlement sets correct fields
    - **Property 7: Void settlement sets correct fields**
    - **Validates: Requirements 5.1**
    - Use `fc.record({ amount: fc.integer({ min: 1 }), status: fc.constantFrom("pending", "confirmed", "disputed") })` for settlement data
    - Assert `status === "voided" && adminNote === reason && resolvedByAdmin === adminId`

  - [x] 9.3 Write property test for void settlement — Property 8: Void settlement notifies both parties
    - **Property 8: Void settlement notifies both parties**
    - **Validates: Requirements 5.4**
    - Use `fc.record({ fromUser: fc.string(), toUser: fc.string() })` for settlement parties
    - Assert `notifyCalls` contains exactly the `fromUser` and `toUser` IDs

  - [x] 9.4 Write unit tests for void settlement route
    - Test 404 when settlement does not exist
    - Test 409 when settlement is already voided
    - Test 401 when not admin
    - _Requirements: 5.6, 5.7, 5.8_

- [x] 10. Update user profile API route — `PATCH /api/admin/users/[userId]/profile`
  - [x] 10.1 Create `app/api/admin/users/[userId]/profile/route.ts` with the `PATCH` handler
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Parse `name` and `email` from request body; return 400 if neither is provided
    - Validate: return 400 if `name` is an empty string; return 400 if `email` does not match `[^\s@]+@[^\s@]+\.[^\s@]+`
    - Fetch the User document (excluding `password`); return 404 if not found
    - If `email` provided, check for duplicate email on another user; return 409 if conflict
    - Apply updates using `$set` — never touch the `password` field
    - Fire-and-forget: call `logAction()` with action `"user.admin_profile_updated"`, `before` = `{ name, email }` (old values), `after` = `{ name, email }` (new values), `resourceId`
    - Fire-and-forget: call `notify()` for the affected user informing them their profile was updated by an admin
    - Return `{ success: true, user: { _id, name, email } }` on success
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 8.2_

  - [x] 10.2 Write property test for profile update — Property 9: Profile update applies valid fields
    - **Property 9: Profile update applies valid fields**
    - **Validates: Requirements 6.1**
    - Use `fc.string({ minLength: 1 })` for name and a valid email generator
    - Assert User document reflects new `name` and/or `email` after update

  - [x] 10.3 Write property test for profile update — Property 10: Invalid email format is always rejected
    - **Property 10: Invalid email format is always rejected**
    - **Validates: Requirements 6.5**
    - Use `fc.string()` filtered to strings not matching `[^\s@]+@[^\s@]+\.[^\s@]+`
    - Assert HTTP 400 and user document unchanged

  - [x] 10.4 Write property test for profile update — Property 11: Password is never modified
    - **Property 11: Password is never modified by profile-update or password-reset endpoints**
    - **Validates: Requirements 6.9, 7.4**
    - Include a `password` field in the request body with arbitrary values
    - Assert `user.password` is byte-for-byte identical before and after the operation

  - [x] 10.5 Write unit tests for profile update route
    - Test 404 when user does not exist
    - Test 409 when email is already in use by another user
    - Test 400 when neither name nor email is provided
    - Test 400 when name is empty string
    - Test 401 when not admin
    - _Requirements: 6.4, 6.6, 6.7, 6.8, 6.10_

- [x] 11. Trigger password reset API route — `POST /api/admin/users/[userId]/reset-password`
  - [x] 11.1 Create `app/api/admin/users/[userId]/reset-password/route.ts` with the `POST` handler
    - Call `requireAdmin()`, return 401 if not admin
    - Call `dbConnect()`
    - Fetch the User document (excluding `password`); return 404 if not found
    - Fire-and-forget: call `logAction()` with action `"user.admin_password_reset_triggered"`, `after` = `{ userId, email }`, `resourceId`
    - Return `{ success: true, message: "Password reset logged" }` — do not set or expose the password
    - Wrap unexpected errors with `logError()` from `@/lib/logger`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.2_

  - [x] 11.2 Write unit tests for password reset route
    - Test 404 when user does not exist
    - Test 200 for valid user (verify logAction called with correct action string)
    - Test 401 when not admin
    - _Requirements: 7.5, 7.6_

- [x] 12. Audit log coverage — property and integration tests
  - [x] 12.1 Write property test — Property 12: Audit log entries always contain actorId, actorName, and reason for destructive actions
    - **Property 12: Audit log entries always contain actorId, actorName, and reason for destructive actions**
    - **Validates: Requirements 8.2, 8.4**
    - Use `fc.record({ actorId: fc.string({ minLength: 1 }), actorName: fc.string({ minLength: 1 }), reason: fc.string({ minLength: 1 }) })` for admin session and reason
    - Assert resulting `AuditLog` document has non-empty `actorId`, `actorName`, and `after.reason`

  - [x] 12.2 Write property test — Property 13: Group-scoped audit log entries always contain groupId
    - **Property 13: Group-scoped audit log entries always contain groupId**
    - **Validates: Requirements 8.3**
    - For each group-scoped action (expense, member, group, settlement), assert `AuditLog.groupId` matches the affected group's ID

  - [x] 12.3 Write integration tests for audit log immutability
    - Attempt to call `.save()` on an existing `AuditLog` document and assert it throws
    - Verify new `AuditAction` enum values are accepted by the schema without validation errors
    - _Requirements: 8.5_

- [ ] 13. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All write routes follow the pattern: `requireAdmin()` → `dbConnect()` → validate → fetch → mutate → fire-and-forget side effects → return response
- Side-effect helpers (`logAction`, `notify`, `invalidateBalanceCache`) are fire-and-forget with internal try/catch — a failure in any of them must never cause the main API response to fail
- The `GET /api/admin/groups/[groupId]` and `DELETE /api/admin/groups/[groupId]` handlers share the same route file
- Property-based tests use **fast-check** with a minimum of 100 iterations per property, each tagged with `// Feature: admin-enhanced-controls, Property N: <property text>`
- The password-reset endpoint only calls `logAction()` — no email is sent at this time (per product decision in design doc)
