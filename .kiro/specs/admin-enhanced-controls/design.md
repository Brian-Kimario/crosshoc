# Design Document: Admin Enhanced Controls

## Overview

This feature extends the SplitEasy admin panel with seven write-capable capabilities on top of the existing read-only views. The additions follow the established patterns in the codebase: every route is guarded by `requireAdmin()`, every write calls `logAction()`, and every user-facing change calls `notify()`. Destructive operations (void expense, remove member, delete group, void settlement) require a non-empty `reason` field.

Two schema changes are required:
- `Expense`: add `isVoided: boolean` and `voidedAt: Date`
- `Settlement`: extend the `SettlementStatus` union to include `"voided"`

Six new API route files are added under `app/api/admin/`. The `AuditLog` model's `AuditAction` union is extended with six new action strings.

---

## Architecture

The feature is purely server-side. No new client-side state management is introduced; the admin UI pages under `app/admin/` call the new API routes via `fetch`.

```
Admin Browser
     │
     ▼
Next.js API Routes (/api/admin/*)
     │
     ├── requireAdmin()          ← auth guard (lib/admin-auth.ts)
     ├── dbConnect()             ← MongoDB connection (lib/db.ts)
     ├── Mongoose Models         ← Expense, Settlement, Group, User, AuditLog
     ├── invalidateBalanceCache()← balance invalidation (lib/balance-cache.ts)
     ├── logAction()             ← audit trail (lib/audit.ts)
     └── notify()                ← in-app + web-push (lib/notify.ts)
```

All new routes follow the same middleware chain as existing admin routes. No new middleware is introduced.

---

## Components and Interfaces

### New API Routes

#### 1. Group Detail

```
GET /api/admin/groups/[groupId]
```

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `expensePage` | number | 1 | Page number for expenses list |
| `settlementPage` | number | 1 | Page number for settlements list |

**Response 200:**
```ts
{
  group: {
    _id: string;
    name: string;
    currency: string;
    createdAt: string;          // ISO date
    inviteToken: string | null;
    inviteExpiresAt: string | null;
    memberCount: number;
  };
  members: Array<{
    userId: string;
    name: string;
    email: string;
    shareRatio: number;
    balance: number;            // integer cents, from balance cache
  }>;
  expenses: {
    data: Array<{
      _id: string;
      description: string;
      amount: number;           // integer cents
      category: string;
      splitType: string;
      paidByName: string;
      createdAt: string;
      isVoided: boolean;
      voidedAt: string | null;
    }>;
    total: number;
    page: number;
  };
  settlements: {
    data: Array<{
      _id: string;
      fromUserName: string;
      toUserName: string;
      amount: number;           // integer cents
      method: string;
      status: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
  };
}
```

**Error responses:** 401 (not admin), 404 (group not found)

---

#### 2. Void Expense

```
POST /api/admin/expenses/[expenseId]/void
```

**Request body:**
```ts
{ reason: string }   // non-empty required
```

**Response 200:**
```ts
{ success: true; voidedAt: string }
```

**Error responses:** 400 (missing/empty reason), 401, 404 (not found), 409 (already voided)

---

#### 3. Remove Member

```
DELETE /api/admin/groups/[groupId]/members/[userId]
```

**Request body:**
```ts
{ reason: string }   // non-empty required
```

**Response 200:**
```ts
{ success: true }
```

**Error responses:** 400 (missing/empty reason), 401, 404 (group or member not found)

---

#### 4. Delete Group

```
DELETE /api/admin/groups/[groupId]
```

**Request body:**
```ts
{ reason: string }   // non-empty required
```

**Response 200:**
```ts
{ success: true; deletedExpenses: number; deletedSettlements: number }
```

**Error responses:** 400 (missing/empty reason), 401, 404 (group not found)

---

#### 5. Void Settlement

```
POST /api/admin/settlements/[settlementId]/void
```

**Request body:**
```ts
{ reason: string }   // non-empty required
```

**Response 200:**
```ts
{ success: true }
```

**Error responses:** 400 (missing/empty reason), 401, 404 (not found), 409 (already voided)

---

#### 6. Update User Profile

```
PATCH /api/admin/users/[userId]/profile
```

**Request body** (at least one field required):
```ts
{
  name?: string;    // non-empty if provided
  email?: string;   // valid email format if provided
}
```

**Response 200:**
```ts
{ success: true; user: { _id: string; name: string; email: string } }
```

**Error responses:** 400 (invalid/missing fields), 401, 404 (user not found), 409 (email conflict)

---

#### 7. Trigger Password Reset

```
POST /api/admin/users/[userId]/reset-password
```

**Request body:** none required

**Response 200:**
```ts
{ success: true; message: "Password reset logged" }
```

**Error responses:** 401, 404 (user not found)

> Note: Per product decision, this endpoint only calls `logAction()` with `user.admin_password_reset_triggered` and returns success. No email is sent at this time.

---

### Route File Map

| Route | File |
|---|---|
| `GET /api/admin/groups/[groupId]` | `app/api/admin/groups/[groupId]/route.ts` |
| `DELETE /api/admin/groups/[groupId]` | `app/api/admin/groups/[groupId]/route.ts` |
| `DELETE /api/admin/groups/[groupId]/members/[userId]` | `app/api/admin/groups/[groupId]/members/[userId]/route.ts` |
| `POST /api/admin/expenses/[expenseId]/void` | `app/api/admin/expenses/[expenseId]/void/route.ts` |
| `POST /api/admin/settlements/[settlementId]/void` | `app/api/admin/settlements/[settlementId]/void/route.ts` |
| `PATCH /api/admin/users/[userId]/profile` | `app/api/admin/users/[userId]/profile/route.ts` |
| `POST /api/admin/users/[userId]/reset-password` | `app/api/admin/users/[userId]/reset-password/route.ts` |

---

## Data Models

### Expense Schema Changes

Add two optional fields to `lib/models/Expense.ts`:

```ts
// IExpense interface additions
isVoided?: boolean;   // default: false
voidedAt?: Date;      // set when isVoided becomes true

// Schema additions
isVoided: {
  type: Boolean,
  default: false,
  index: true,
},
voidedAt: {
  type: Date,
  default: null,
},
```

Voided expenses are retained in the database for audit purposes. Balance calculations must filter out expenses where `isVoided: true`. The existing `calculateGroupBalances` function in `lib/balance-server.ts` must be updated to add `{ isVoided: { $ne: true } }` to its expense query.

**Display rule:** Admin group detail view and user-facing expense lists show voided expenses with an `isVoided: true` flag so the UI can render a "Voided" label.

---

### Settlement Schema Changes

Extend `SettlementStatus` to include `"voided"`:

```ts
// lib/models/Settlement.ts
export type SettlementStatus = "pending" | "confirmed" | "disputed" | "voided";

// Schema enum update
status: {
  type: String,
  enum: ["pending", "confirmed", "disputed", "voided"],
  default: "pending",
  index: true,
},
```

Voided settlements do not affect balance calculations. The existing `calculateGroupBalances` function must filter out settlements where `status === "voided"`.

---

### AuditLog Schema Changes

Extend `AuditAction` in `lib/models/AuditLog.ts` with six new action strings:

```ts
export type AuditAction =
  // ... existing actions ...
  | "expense.admin_voided"
  | "member.admin_removed"
  | "group.admin_deleted"
  | "settlement.admin_voided"
  | "user.admin_profile_updated"
  | "user.admin_password_reset_triggered";
```

The schema `enum` array must be updated to match.

---

### Audit Log Payloads

| Action | `before` | `after` |
|---|---|---|
| `expense.admin_voided` | `{ description, amount, groupId, splits }` | `{ reason, voidedAt }` |
| `member.admin_removed` | `{ userId, name }` | `{ reason, groupId }` |
| `group.admin_deleted` | `{ name, memberCount, expenseCount, settlementCount }` | `{ reason }` |
| `settlement.admin_voided` | `{ status, amount, fromUser, toUser }` | `{ reason }` |
| `user.admin_profile_updated` | `{ name, email }` | `{ name, email }` (new values) |
| `user.admin_password_reset_triggered` | — | `{ userId, email }` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Void expense sets correct fields

*For any* non-voided expense, after an admin void operation with a valid non-empty reason, the expense document must have `isVoided === true` and `voidedAt` set to a valid Date.

**Validates: Requirements 2.1**

---

### Property 2: Void expense notifies all split members

*For any* expense with N entries in its `splits` array, voiding that expense must trigger exactly N `notify()` calls — one per unique user in `splits`.

**Validates: Requirements 2.4**

---

### Property 3: Empty/whitespace reason is always rejected for destructive actions

*For any* destructive admin request (void expense, remove member, delete group, void settlement) where the `reason` field is absent, an empty string, or composed entirely of whitespace characters, the API must return HTTP 400 and the target document must remain unmodified.

**Validates: Requirements 2.5, 3.5, 4.4, 5.5**

---

### Property 4: Remove member removes exactly that member

*For any* group containing a given member, after an admin remove-member operation, that user's entry must not appear in `Group.members[]`, and all other members must remain present.

**Validates: Requirements 3.1**

---

### Property 5: Delete group removes all associated documents

*For any* group with any number of expenses and settlements, after an admin delete-group operation, the Group document, all Expense documents with that `group` field, and all Settlement documents with that `group` field must not exist in the database.

**Validates: Requirements 4.1**

---

### Property 6: Delete group notifies all members

*For any* group with N members, an admin delete-group operation must trigger exactly N `notify()` calls — one per member at the time of deletion.

**Validates: Requirements 4.3**

---

### Property 7: Void settlement sets correct fields

*For any* non-voided settlement, after an admin void operation with a valid non-empty reason, the settlement's `status` must equal `"voided"`, `adminNote` must be set to the reason, and `resolvedByAdmin` must be set to the admin's user ID.

**Validates: Requirements 5.1**

---

### Property 8: Void settlement notifies both parties

*For any* settlement, voiding it must trigger exactly 2 `notify()` calls — one for `fromUser` and one for `toUser`.

**Validates: Requirements 5.4**

---

### Property 9: Profile update applies valid fields

*For any* valid name (non-empty string) and/or valid email (matching `[^\s@]+@[^\s@]+\.[^\s@]+`), after an admin profile-update operation, the User document must reflect the new values.

**Validates: Requirements 6.1**

---

### Property 10: Invalid email format is always rejected

*For any* string that does not match the email regex `[^\s@]+@[^\s@]+\.[^\s@]+`, a profile-update request using that string as the `email` field must return HTTP 400 and leave the user document unchanged.

**Validates: Requirements 6.5**

---

### Property 11: Password is never modified by profile-update or password-reset endpoints

*For any* profile-update or password-reset request — regardless of what fields are included in the request body — the `password` field on the target User document must remain byte-for-byte identical before and after the operation.

**Validates: Requirements 6.9, 7.4**

---

### Property 12: Audit log entries always contain actorId, actorName, and reason for destructive actions

*For any* admin write action, the resulting `AuditLog` document must contain a non-empty `actorId` and `actorName`. For any destructive action (void expense, remove member, delete group, void settlement), the `after` field must contain the `reason` string supplied in the request.

**Validates: Requirements 8.2, 8.4**

---

### Property 13: Group-scoped audit log entries always contain groupId

*For any* admin action on a group-scoped resource (expense, member, group, settlement), the resulting `AuditLog` document must contain the correct `groupId` of the affected group.

**Validates: Requirements 8.3**

---

## Error Handling

| Scenario | HTTP Status | Response body | Side effects |
|---|---|---|---|
| Not authenticated / not admin | 401 | `{ error: "Unauthorized" }` | None |
| Group not found | 404 | `{ error: "Group not found" }` | None |
| Expense not found | 404 | `{ error: "Expense not found" }` | None |
| Settlement not found | 404 | `{ error: "Settlement not found" }` | None |
| User not found | 404 | `{ error: "User not found" }` | None |
| Member not in group | 404 | `{ error: "Member not found in group" }` | None |
| Expense already voided | 409 | `{ error: "Expense is already voided" }` | None |
| Settlement already voided | 409 | `{ error: "Settlement is already voided" }` | None |
| Email already in use | 409 | `{ error: "Email already in use" }` | None |
| Missing or empty `reason` | 400 | `{ error: "reason is required" }` | None |
| Invalid email format | 400 | `{ error: "Invalid email format" }` | None |
| Empty name | 400 | `{ error: "name cannot be empty" }` | None |
| No updatable fields provided | 400 | `{ error: "Provide name and/or email" }` | None |
| `logAction()` failure | — | No effect on response | Error logged to console; main operation succeeds |
| `notify()` failure | — | No effect on response | Error logged to console; main operation succeeds |
| `invalidateBalanceCache()` failure | — | No effect on response | Error logged to console; main operation succeeds |

All three side-effect helpers (`logAction`, `notify`, `invalidateBalanceCache`) are fire-and-forget with internal try/catch — consistent with the existing codebase pattern. A failure in any of them must never cause the main API response to fail.

---

## Testing Strategy

### Unit Tests

Focus on pure validation logic extracted into helper functions:

- `validateReason(reason: unknown): boolean` — returns false for absent, empty, or whitespace-only strings
- `validateEmail(email: string): boolean` — tests the regex `[^\s@]+@[^\s@]+\.[^\s@]+`
- `validateName(name: string): boolean` — returns false for empty or whitespace-only strings
- Balance calculation exclusion of voided expenses and voided settlements

Example-based unit tests cover:
- 404 path for each endpoint (non-existent resource IDs)
- 409 path for already-voided expense and settlement
- 409 path for duplicate email on profile update
- 400 path for missing fields on profile update
- AuditLog immutability (attempt to `.save()` an existing log entry, expect error)
- Password-reset endpoint returns 200 for valid user

### Property-Based Tests

Use **fast-check** (already a common choice in TypeScript/Next.js projects) with a minimum of **100 iterations** per property.

Each test is tagged with a comment in the format:
`// Feature: admin-enhanced-controls, Property N: <property text>`

Properties to implement as property-based tests:

| Property | Generator inputs | Assertion |
|---|---|---|
| P1: Void expense sets fields | Random expense documents (non-voided) | `isVoided === true && voidedAt instanceof Date` |
| P2: Void expense notifies split members | Random expenses with 1–10 splits | `notifyCalls.length === splits.length` |
| P3: Empty reason rejected | Strings from `fc.string()` filtered to whitespace-only + empty + absent | HTTP 400, document unchanged |
| P4: Remove member removes exactly that member | Random groups with 2–10 members, pick one | Member absent, others present |
| P5: Delete group removes all documents | Random groups with 0–20 expenses and 0–10 settlements | All three collections empty for that groupId |
| P6: Delete group notifies all members | Random groups with 1–10 members | `notifyCalls.length === members.length` |
| P7: Void settlement sets fields | Random settlements (non-voided) | `status === "voided" && adminNote && resolvedByAdmin` |
| P8: Void settlement notifies both parties | Random settlements | `notifyCalls` contains fromUser and toUser IDs |
| P9: Profile update applies valid fields | `fc.string({ minLength: 1 })` for name, valid email generator | User document reflects new values |
| P10: Invalid email rejected | `fc.string()` filtered to strings not matching email regex | HTTP 400, user unchanged |
| P11: Password never modified | Any request body including `password` field | `user.password` unchanged after operation |
| P12: Audit log contains actorId, actorName, reason | Random admin sessions and reason strings | AuditLog has non-empty actorId, actorName, and reason in after |
| P13: Group-scoped audit log contains groupId | Random group-scoped actions | AuditLog.groupId matches the affected group |

### Integration Tests

The following behaviors are verified with 1–3 representative examples rather than property tests, because they test infrastructure wiring or side effects that don't vary meaningfully with input:

- `invalidateBalanceCache()` is called after void expense, remove member, delete group, void settlement
- `logAction()` is called with the correct `action` string for each new endpoint
- `notify()` is called for the correct user IDs in each scenario
- AuditLog documents are created in MongoDB with the correct fields
- New `AuditAction` enum values are accepted by the AuditLog schema without validation errors
