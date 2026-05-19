# Requirements Document

## Introduction

This feature extends the SplitEasy admin panel with seven new write-capable capabilities that go beyond the existing read-only group/settlement views. Admins gain the ability to drill into group details, void expenses, remove members, delete groups, void any settlement, update user profiles, and trigger password resets — all with mandatory audit logging, reason fields for destructive actions, and in-app notifications to affected users.

All new API routes are protected by `requireAdmin()`. Every write action calls `logAction()`. Destructive actions (void expense, remove member, delete group, void settlement) require a non-empty `reason` field. Admins cannot read or set passwords directly.

---

## Glossary

- **Admin**: A SplitEasy user with `isAdmin: true`, authenticated via `requireAdmin()`.
- **Group**: A MongoDB `Group` document containing members, expenses, and settlements.
- **Expense**: A MongoDB `Expense` document recording a shared cost within a group.
- **Settlement**: A MongoDB `Settlement` document recording a payment between two group members.
- **Member**: An entry in `Group.members[]` linking a `User` to a group with a `shareRatio`.
- **Balance_Cache**: The `cachedBalances` sub-document on a `Group`, invalidated by `invalidateBalanceCache()`.
- **Audit_Log**: An immutable `AuditLog` document written by `logAction()`.
- **Notification**: An in-app and optional web-push message written by `notify()`.
- **Password_Reset_Flow**: The existing email-based reset flow that sends a time-limited token to the user's email address.
- **Reason**: A non-empty string supplied by the admin in the request body explaining why a destructive action was taken.
- **Admin_Panel**: The Next.js pages under `/admin` and API routes under `/api/admin`.

---

## Requirements

### Requirement 1: Group Drill-Down

**User Story:** As an admin, I want to view the full details of any group — including all expenses, all settlements, and each member's current balance — so that I can investigate financial discrepancies without needing direct database access.

#### Acceptance Criteria

1. WHEN an admin requests the detail view for a group, THE Admin_Panel SHALL return the group's name, currency, creation date, and invite status.
2. WHEN an admin requests the detail view for a group, THE Admin_Panel SHALL return all expenses belonging to that group, including description, amount in cents, category, split type, payer name, and creation date.
3. WHEN an admin requests the detail view for a group, THE Admin_Panel SHALL return all settlements belonging to that group, including payer name, payee name, amount in cents, method, status, and creation date.
4. WHEN an admin requests the detail view for a group, THE Admin_Panel SHALL return each member's current balance by reading from the Balance_Cache (recalculating if stale).
5. WHEN an admin requests the detail view for a group that does not exist, THE Admin_Panel SHALL return a 404 error response.
6. WHEN an unauthenticated or non-admin user requests the group detail endpoint, THE Admin_Panel SHALL return a 401 error response.
7. THE Admin_Panel SHALL support pagination for the expenses list within a group detail view, returning at most 50 expenses per page.
8. THE Admin_Panel SHALL support pagination for the settlements list within a group detail view, returning at most 50 settlements per page.

---

### Requirement 2: Void Any Expense

**User Story:** As an admin, I want to void a specific expense so that I can correct data errors without directly editing financial amounts, while keeping a full audit trail.

#### Acceptance Criteria

1. WHEN an admin submits a void request for an expense with a non-empty `reason`, THE Admin_Panel SHALL mark the expense as inactive by setting `isVoided: true` and recording the `voidedAt` timestamp.
2. WHEN an admin voids an expense, THE Admin_Panel SHALL call `invalidateBalanceCache()` for the expense's group so that balance recalculations reflect the voided expense.
3. WHEN an admin voids an expense, THE Admin_Panel SHALL call `logAction()` with action `expense.admin_voided`, the expense's `before` state, and the supplied `reason` in the `after` field.
4. WHEN an admin voids an expense, THE Admin_Panel SHALL call `notify()` for every user listed in the expense's `splits` array, informing them that the expense was voided by an admin.
5. WHEN an admin submits a void request for an expense without a `reason` field or with an empty `reason`, THE Admin_Panel SHALL return a 400 error response and SHALL NOT modify the expense.
6. WHEN an admin submits a void request for an expense that does not exist, THE Admin_Panel SHALL return a 404 error response.
7. WHEN an admin submits a void request for an expense that is already voided, THE Admin_Panel SHALL return a 409 error response.
8. WHEN an unauthenticated or non-admin user submits a void request for an expense, THE Admin_Panel SHALL return a 401 error response.

---

### Requirement 3: Remove a Member from a Group

**User Story:** As an admin, I want to remove any user from any group so that I can correct membership errors, while notifying the removed user and preserving an audit trail.

#### Acceptance Criteria

1. WHEN an admin submits a remove-member request with a non-empty `reason`, THE Admin_Panel SHALL remove the target user's entry from `Group.members[]`.
2. WHEN an admin removes a member, THE Admin_Panel SHALL call `invalidateBalanceCache()` for the affected group.
3. WHEN an admin removes a member, THE Admin_Panel SHALL call `logAction()` with action `member.admin_removed`, recording the member's userId and name in the `before` field and the `reason` in the `after` field.
4. WHEN an admin removes a member, THE Admin_Panel SHALL call `notify()` for the removed user, informing them that they were removed from the group by an admin.
5. WHEN an admin submits a remove-member request without a `reason` field or with an empty `reason`, THE Admin_Panel SHALL return a 400 error response and SHALL NOT modify the group.
6. WHEN an admin submits a remove-member request for a user who is not a member of the specified group, THE Admin_Panel SHALL return a 404 error response.
7. WHEN an admin submits a remove-member request for a group that does not exist, THE Admin_Panel SHALL return a 404 error response.
8. WHEN an unauthenticated or non-admin user submits a remove-member request, THE Admin_Panel SHALL return a 401 error response.

---

### Requirement 4: Delete a Group

**User Story:** As an admin, I want to delete an entire group along with all its expenses and settlements so that I can remove test data or groups created in error, while notifying all members and preserving an audit trail.

#### Acceptance Criteria

1. WHEN an admin submits a delete-group request with a non-empty `reason`, THE Admin_Panel SHALL delete the Group document, all associated Expense documents, and all associated Settlement documents in a single coordinated operation.
2. WHEN an admin deletes a group, THE Admin_Panel SHALL call `logAction()` with action `group.admin_deleted`, recording the group name, member count, expense count, and settlement count in the `before` field and the `reason` in the `after` field.
3. WHEN an admin deletes a group, THE Admin_Panel SHALL call `notify()` for every user who was a member of the group at the time of deletion, informing them that the group was deleted by an admin.
4. WHEN an admin submits a delete-group request without a `reason` field or with an empty `reason`, THE Admin_Panel SHALL return a 400 error response and SHALL NOT delete any documents.
5. WHEN an admin submits a delete-group request for a group that does not exist, THE Admin_Panel SHALL return a 404 error response.
6. WHEN an unauthenticated or non-admin user submits a delete-group request, THE Admin_Panel SHALL return a 401 error response.

---

### Requirement 5: Void Any Settlement

**User Story:** As an admin, I want to void any settlement regardless of its current status so that I can correct duplicate entries or system errors, while notifying both parties and preserving an audit trail.

#### Acceptance Criteria

1. WHEN an admin submits a void-settlement request with a non-empty `reason`, THE Admin_Panel SHALL set the settlement's status to `"voided"` and record the `adminNote` and `resolvedByAdmin` fields.
2. WHEN an admin voids a settlement, THE Admin_Panel SHALL call `invalidateBalanceCache()` for the settlement's group.
3. WHEN an admin voids a settlement, THE Admin_Panel SHALL call `logAction()` with action `settlement.admin_voided`, recording the settlement's `before` state (status, amount, fromUser, toUser) and the `reason` in the `after` field.
4. WHEN an admin voids a settlement, THE Admin_Panel SHALL call `notify()` for both the `fromUser` and the `toUser` of the settlement, informing them that the settlement was voided by an admin.
5. WHEN an admin submits a void-settlement request without a `reason` field or with an empty `reason`, THE Admin_Panel SHALL return a 400 error response and SHALL NOT modify the settlement.
6. WHEN an admin submits a void-settlement request for a settlement that does not exist, THE Admin_Panel SHALL return a 404 error response.
7. WHEN an admin submits a void-settlement request for a settlement that is already voided, THE Admin_Panel SHALL return a 409 error response.
8. WHEN an unauthenticated or non-admin user submits a void-settlement request, THE Admin_Panel SHALL return a 401 error response.

---

### Requirement 6: Update User Profile

**User Story:** As an admin, I want to update a user's name and/or email address so that I can assist users who cannot access their own account settings, while logging the before and after values.

#### Acceptance Criteria

1. WHEN an admin submits a profile-update request containing a valid `name`, `email`, or both, THE Admin_Panel SHALL update the corresponding fields on the User document.
2. WHEN an admin updates a user's profile, THE Admin_Panel SHALL call `logAction()` with action `user.admin_profile_updated`, recording the previous `name` and `email` in the `before` field and the new values in the `after` field.
3. WHEN an admin updates a user's profile, THE Admin_Panel SHALL call `notify()` for the affected user, informing them that their profile was updated by an admin.
4. WHEN an admin submits a profile-update request with an `email` that is already in use by another user, THE Admin_Panel SHALL return a 409 error response and SHALL NOT modify the user.
5. WHEN an admin submits a profile-update request with an `email` that does not match the format `[^\s@]+@[^\s@]+\.[^\s@]+`, THE Admin_Panel SHALL return a 400 error response and SHALL NOT modify the user.
6. WHEN an admin submits a profile-update request with a `name` that is an empty string, THE Admin_Panel SHALL return a 400 error response and SHALL NOT modify the user.
7. WHEN an admin submits a profile-update request that contains neither `name` nor `email`, THE Admin_Panel SHALL return a 400 error response.
8. WHEN an admin submits a profile-update request for a user that does not exist, THE Admin_Panel SHALL return a 404 error response.
9. THE Admin_Panel SHALL NOT allow an admin to read or set a user's password through the profile-update endpoint.
10. WHEN an unauthenticated or non-admin user submits a profile-update request, THE Admin_Panel SHALL return a 401 error response.

---

### Requirement 7: Trigger Password Reset

**User Story:** As an admin, I want to trigger a password reset email for any user so that I can help users who are locked out of their accounts, without ever handling their password directly.

#### Acceptance Criteria

1. WHEN an admin submits a password-reset request for a valid user, THE Admin_Panel SHALL invoke the existing Password_Reset_Flow to send a reset email to the user's registered email address.
2. WHEN an admin triggers a password reset, THE Admin_Panel SHALL call `logAction()` with action `user.admin_password_reset_triggered`, recording the target user's id and email in the `after` field.
3. WHEN an admin triggers a password reset, THE Admin_Panel SHALL return a 200 response indicating the reset email was dispatched, regardless of whether the email delivery succeeded, to avoid leaking account existence.
4. THE Admin_Panel SHALL NOT allow an admin to set a user's password directly through this endpoint.
5. WHEN an admin submits a password-reset request for a user that does not exist, THE Admin_Panel SHALL return a 404 error response.
6. WHEN an unauthenticated or non-admin user submits a password-reset request, THE Admin_Panel SHALL return a 401 error response.

---

### Requirement 8: Audit Log Coverage for New Actions

**User Story:** As an admin, I want every new admin write action to appear in the existing audit log so that there is a complete, immutable record of all administrative changes.

#### Acceptance Criteria

1. THE Audit_Log SHALL record entries for each of the following new actions: `expense.admin_voided`, `member.admin_removed`, `group.admin_deleted`, `settlement.admin_voided`, `user.admin_profile_updated`, `user.admin_password_reset_triggered`.
2. WHEN any new admin write action is performed, THE Audit_Log entry SHALL include the `actorId` and `actorName` of the performing admin.
3. WHEN any new admin write action is performed on a group-scoped resource, THE Audit_Log entry SHALL include the `groupId` of the affected group.
4. WHEN any destructive admin action is performed, THE Audit_Log entry SHALL include the `reason` supplied by the admin in the `after` field.
5. THE Audit_Log SHALL be immutable — no admin action SHALL modify or delete existing Audit_Log entries.
