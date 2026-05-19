# SplitEasy Admin System — Technical README

> **Purpose:** This document is written for Claude (or any AI assistant) to understand the current admin system architecture, identify gaps, and generate precise implementation prompts for Kiro to execute. Read every section before generating any prompt.

---

## PART 1 — Live Activity & Audit Log: Current Mechanism

### What exists

**AuditLog Model** (`lib/models/AuditLog.ts`)
- MongoDB collection: `auditlogs`
- Fields: `action`, `actorId`, `actorName`, `actorType`, `groupId`, `resourceId`, `before`, `after`, `ipAddress`, `timestamp`
- Immutable — pre-save hook blocks updates
- Indexed on: `action`, `actorId`, `groupId`, `timestamp`

**Supported action types (enum):**
```
expense.created, expense.edited, expense.deleted
settlement.created, settlement.confirmed, settlement.disputed
member.added, member.removed, group.created
user.disable, user.enable, user.make-admin, user.remove-admin, user.deleted
settlement.admin_resolved, expense.admin_voided, member.admin_removed
group.admin_deleted, settlement.admin_voided
user.admin_profile_updated, user.admin_password_reset_triggered
expense.voided (NEW — added by user-level void endpoint)
```

**Missing action types (not in enum but called in code):**
- `expense.voided` — the new user-level void route calls `logAction` with this but it's not in the AuditLog enum, causing silent failures
- `group.archived`, `group.restored` — archive actions are not logged at all

**API Route** (`app/api/admin/audit-log/route.ts`)
- `GET /api/admin/audit-log?page=1&action=&actor=`
- Returns: `{ logs: AuditLog[], total: number, page: number }`
- Pagination: 50 per page
- Filters: action (regex), actorName (regex)
- **Missing filters:** date range, groupId, resourceId, actorId

**Live Activity Page** (`app/admin/activity/page.tsx`)
- Polls `/api/admin/audit-log?page=1` every 10 seconds
- Shows last 50 entries, keeps max 100 in memory
- Tracks new item count since page load
- **Problems:**
  1. Polls the full audit log endpoint — expensive, returns all actions not just recent
  2. No date filter — can't distinguish "new since last poll" from "already seen"
  3. No real-time — 10s delay means events feel stale
  4. No groupId/resourceId links — can't click through to the affected group
  5. Action color map is incomplete (missing admin actions like `expense.admin_voided`)

**Audit Log Page** (`app/admin/audit-log/page.tsx`)
- Paginated table with action + actor filters
- Shows: timestamp, actor, action, resourceId, time-ago
- **Problems:**
  1. No date range filter
  2. No groupId filter (can't see all actions for a specific group)
  3. resourceId shown as raw MongoDB ObjectId — not clickable
  4. `before`/`after` data fetched but never displayed (no expand/detail view)
  5. Action color map missing many admin action types
  6. No export (CSV download)

### What needs to be fixed

**Priority 1 — AuditLog enum:**
Add missing action types to `lib/models/AuditLog.ts`:
- `expense.voided` (user-level void)
- `group.archived`
- `group.restored`

**Priority 2 — Live Activity improvements:**
- Add a dedicated `/api/admin/activity/recent` endpoint that returns only entries from the last 5 minutes (or since a `since` timestamp param)
- Switch polling to use `since` param to avoid re-fetching old data
- Make action labels human-readable (e.g. "expense.admin_voided" → "Admin voided expense")
- Add clickable links: groupId → `/admin/groups/[id]`, resourceId for expenses → `/admin/groups/[id]`
- Complete the ACTION_COLORS map

**Priority 3 — Audit Log improvements:**
- Add date range filter (from/to date pickers)
- Add groupId filter (search by group name or ID)
- Make resourceId clickable (link to admin group detail if groupId is present)
- Add expandable row to show `before`/`after` diff
- Add CSV export button

---

## PART 2 — Admin UI: Current State & What Needs Improvement

### Admin Pages Inventory

| Route | File | Status | Issues |
|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | ✅ Working | Performance.measure error in dev (fixed with `force-dynamic`) |
| `/admin/users` | `app/admin/users/page.tsx` | ✅ Working | See below |
| `/admin/groups` | `app/admin/groups/page.tsx` | ✅ Working | Links now go to `/admin/groups/[id]` |
| `/admin/groups/[groupId]` | `app/admin/groups/[groupId]/page.tsx` | ✅ Working | New page — view members, expenses, void |
| `/admin/settlements` | `app/admin/settlements/page.tsx` | ✅ Working | Void button added, group links fixed |
| `/admin/audit-log` | `app/admin/audit-log/page.tsx` | ⚠️ Partial | Missing filters, no detail view |
| `/admin/activity` | `app/admin/activity/page.tsx` | ⚠️ Partial | Polling is inefficient, no links |
| `/admin/disputes` | `app/admin/disputes/page.tsx` | ❓ Unknown | Not reviewed |
| `/admin/feedback` | `app/admin/feedback/page.tsx` | ❓ Unknown | Not reviewed |
| `/admin/health` | `app/admin/health/page.tsx` | ❓ Unknown | Not reviewed |
| `/admin/exchange-rates` | `app/admin/exchange-rates/page.tsx` | ❓ Unknown | Not reviewed |
| `/admin/invites` | `app/admin/invites/page.tsx` | ❓ Unknown | Not reviewed |

### Admin API Routes Inventory

| Route | Method | Purpose | Status |
|---|---|---|---|
| `/api/admin/groups` | GET | List all groups with stats | ✅ |
| `/api/admin/groups/[id]` | GET | Group detail (members, expenses, settlements) | ✅ |
| `/api/admin/groups/[id]` | DELETE | Delete group with reason + email | ✅ |
| `/api/admin/groups/[id]/members/[userId]` | DELETE | Remove member with reason + email | ✅ |
| `/api/admin/expenses/[id]/void` | POST | Void expense with reason + audit + email | ✅ |
| `/api/admin/settlements/[id]/void` | POST | Void settlement with reason + audit + email | ✅ |
| `/api/admin/settlements` | GET | List all settlements with status filter | ✅ |
| `/api/admin/users` | GET | List users with search/filter | ✅ |
| `/api/admin/users/[id]` | PATCH | Disable/enable/promote/demote | ✅ |
| `/api/admin/users/[id]` | DELETE | Delete user account | ✅ |
| `/api/admin/users/[id]/disable` | POST | Disable account | ✅ |
| `/api/admin/users/[id]/enable` | POST | Enable account | ✅ |
| `/api/admin/users/[id]/reset-password` | POST | Trigger password reset email | ✅ |
| `/api/admin/users/[id]/profile` | PATCH | Update name/email (never password) | ✅ |
| `/api/admin/audit-log` | GET | Paginated audit log with filters | ⚠️ Needs date/group filters |
| `/api/admin/exchange-rates` | GET/POST | Manage currency exchange rates | ✅ |
| `/api/admin/disputes` | GET | List disputed settlements | ✅ |
| `/api/admin/disputes/[id]/resolve` | POST | Resolve a dispute | ✅ |
| `/api/admin/health` | GET | System health metrics | ✅ |
| `/api/admin/invites` | GET | List active invite tokens | ✅ |
| `/api/admin/feedback` | GET | List user feedback | ✅ |

### What the Admin CAN do (enforced)
- View any group, expense, settlement without being a member
- Void any expense (reason required, audit logged, notifications sent)
- Void any settlement (reason required, audit logged, notifications sent)
- Delete any group (reason required, emails all members)
- Disable/enable any user account
- Delete any user account
- Remove any member from any group (reason required, email sent)
- Trigger password reset for any user (sends email, does NOT set password directly)
- Update user name/email (never password)
- Promote/demote admin status
- View all audit logs
- Manage exchange rates
- Resolve disputes

### What the Admin CANNOT do (by design — no API endpoints)
- Add expenses to groups
- Settle debts on behalf of users
- Set user passwords directly
- Impersonate users

### Known Issues to Fix

**Issue 1 — AuditLog enum missing actions**
File: `lib/models/AuditLog.ts`
The enum doesn't include `expense.voided`, `group.archived`, `group.restored`. The `logAction` utility silently fails when called with an unrecognized action type because Mongoose rejects the document.

**Issue 2 — Archive actions not logged**
Files: `app/api/groups/[id]/archive/route.ts`
The archive (POST) and unarchive (DELETE) routes don't call `logAction`. Every admin action should be auditable.

**Issue 3 — Live Activity page is inefficient**
File: `app/admin/activity/page.tsx`
Polls the full audit log every 10s. Should use a `since` timestamp to only fetch new entries.

**Issue 4 — Audit Log missing detail view**
File: `app/admin/audit-log/page.tsx`
The `before`/`after` fields are fetched but never shown. Admins can't see what changed.

**Issue 5 — Admin group detail page missing member removal UI**
File: `app/admin/groups/[groupId]/page.tsx`
The page shows members but has no "Remove" button. The API exists at `DELETE /api/admin/groups/[id]/members/[userId]` but the UI doesn't expose it.

**Issue 6 — Admin group detail page missing settlements tab**
File: `app/admin/groups/[groupId]/page.tsx`
The API returns settlements data but the page only shows members and expenses. Settlements are not displayed.

**Issue 7 — Admin users page missing password reset button**
File: `components/admin/AdminUsersClient.tsx`
The API exists at `POST /api/admin/users/[id]/reset-password` but the users table has no button to trigger it.

---

## PART 3 — Prompt for Claude to Generate Implementation Instructions

**Give Claude this entire README and ask:**

> "Based on this README, generate a detailed implementation prompt for Kiro (an AI coding assistant) to fix all the issues listed. The prompt should:
> 1. Fix the AuditLog enum to add missing action types
> 2. Add audit logging to the archive/unarchive routes
> 3. Improve the Live Activity page with a `since`-based polling endpoint
> 4. Add an expandable detail row to the Audit Log page showing before/after diffs
> 5. Add member removal UI to the admin group detail page
> 6. Add settlements tab to the admin group detail page
> 7. Add password reset button to the admin users table
> 8. Be specific about which files to edit and what changes to make
> 9. Include the exact API contract for any new endpoints needed"

---

## PART 4 — Architecture Notes for Context

### How audit logging works
```typescript
// lib/audit.ts
await logAction({
  action: "expense.created",  // must match AuditLog enum
  actorId: userId,
  actorName: "Brian",
  groupId: "...",
  resourceId: expenseId,
  before: { description: "old", amount: 1000 },
  after: { description: "new", amount: 2000 },
  ipAddress: request.headers.get("x-forwarded-for"),
});
```

### How admin auth works
```typescript
// In API routes:
const { session, error } = await requireAdmin();
if (error) return error;
// session.userId, session.name, session.email available

// In Server Components:
const session = await getAdminSession();
if (!session) redirect("/login");
```

### How the admin group detail API works
`GET /api/admin/groups/[groupId]` returns:
```json
{
  "group": { "_id", "name", "currency", "createdAt", "memberCount" },
  "members": [{ "userId", "name", "email", "role", "balance" }],
  "expenses": { "data": [...], "total": 50, "page": 1 },
  "settlements": { "data": [...], "total": 12, "page": 1 }
}
```

### Tech stack
- Next.js 15 (App Router), TypeScript, MongoDB/Mongoose, Tailwind CSS
- No Redux — Zustand for client state, SWR for server state
- All admin pages are either Server Components (data fetching) or Client Components (interactive tables)
- Toast notifications via `sonner`
- Icons via `lucide-react`
- Dark theme: background `#0A0F1E`, cards `#0F172A`, borders `#1E293B`
