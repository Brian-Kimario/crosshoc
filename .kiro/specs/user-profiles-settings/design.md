# Design Document

## Introduction

This document describes the technical design for Phase 10 of SplitEasy: User Profiles, Full Settings, and Account Management. It covers data model changes, API route design, component architecture, and integration points with the existing codebase.

The implementation builds on the existing stack: Next.js 14 App Router, MongoDB/Mongoose, custom JWT via `jsonwebtoken` (cookie name `authToken`), Tailwind CSS, Shadcn UI, Framer Motion, Cloudinary, and SWR.

---

## Architecture Overview

### High-Level Component Map

```
app/(dashboard)/settings/page.tsx   ← Server component (auth check + searchParams)
  └── SettingsClient.tsx            ← Client component (tab state, URL sync)
        ├── ProfileTab.tsx          ← Avatar upload, displayName, bio, preferences
        ├── PasswordTab.tsx         ← Current/new/confirm password + strength bar
        ├── EmailTab.tsx            ← New email + password confirmation
        ├── NotificationsTab.tsx    ← Wraps existing NotificationPreferences components
        ├── SessionsTab.tsx         ← Active sessions list + revoke controls
        └── DangerZoneTab.tsx       ← Data export + account deletion

components/ui/UserAvatar.tsx        ← Shared avatar component (photo or initials)

API Routes:
  /api/user/me                      ← GET profile, PATCH profile
  /api/user/avatar                  ← POST upload, DELETE remove
  /api/user/change-password         ← POST
  /api/user/change-email            ← POST
  /api/user/verify-email            ← GET (token in query param)
  /api/user/sessions                ← GET list
  /api/user/sessions/[sessionId]    ← DELETE revoke one
  /api/user/sessions/all            ← DELETE revoke all others
  /api/user/export                  ← POST download JSON
  /api/user/account                 ← DELETE delete account
```

---

## Data Model Changes

### 1. User Schema Extensions (`lib/models/User.ts`)

The existing `IUser` interface and `UserSchema` are extended with the following fields. The existing `avatar` field (unused) is superseded by `avatarUrl`.

**TypeScript interface additions:**

```typescript
// Profile
avatarUrl:    string | null;
bio:          string;
displayName:  string;

// Preferences
preferences: {
  currency:    string;   // default: "USD"
  splitMethod: "equal" | "percent" | "exact";  // default: "equal"
  timezone:    string;   // default: "UTC"
};

// Email change flow
pendingEmail:            string | null;
pendingEmailToken:       string | null;
pendingEmailTokenExpiry: Date | null;

// Session tracking
sessions: Array<{
  sessionId:  string;
  userAgent:  string;
  ipAddress:  string;
  createdAt:  Date;
  lastSeenAt: Date;
  isCurrent:  boolean;
}>;

// Account lifecycle
deletionRequestedAt: Date | null;
dataExportToken:     string | null;
dataExportExpiry:    Date | null;
```

**Mongoose schema additions:**

```typescript
avatarUrl:   { type: String, default: null },
bio:         { type: String, default: "", maxlength: 200 },
displayName: { type: String, default: "" },

preferences: {
  currency:    { type: String, default: "USD" },
  splitMethod: { type: String, enum: ["equal", "percent", "exact"], default: "equal" },
  timezone:    { type: String, default: "UTC" },
},

pendingEmail:            { type: String, default: null },
pendingEmailToken:       { type: String, default: null, select: false },
pendingEmailTokenExpiry: { type: Date,   default: null },

sessions: [{
  sessionId:  { type: String, required: true },
  userAgent:  { type: String, default: "Unknown" },
  ipAddress:  { type: String, default: "Unknown" },
  createdAt:  { type: Date,   default: Date.now },
  lastSeenAt: { type: Date,   default: Date.now },
  isCurrent:  { type: Boolean, default: false },
}],

deletionRequestedAt: { type: Date,   default: null },
dataExportToken:     { type: String, default: null },
dataExportExpiry:    { type: Date,   default: null },
```

---

## Authentication Changes

### 2. Session-Aware JWT (`lib/auth.ts`)

The existing `signToken(userId, tokenVersion)` function is extended. A new `signTokenWithSession` function is added to avoid breaking existing callers:

```typescript
import { randomUUID } from "crypto";

export function signTokenWithSession(
  userId: string,
  tokenVersion: number,
  sessionId: string
): string {
  const secret = getJwtSecret();
  return jwt.sign({ userId, tokenVersion, sessionId }, secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as any);
}
```

The existing `verifyToken` return type is updated to include the optional `sessionId`:

```typescript
export function verifyToken(token: string): {
  userId: string;
  tokenVersion: number;
  sessionId?: string;
} | null
```

**Login route changes (`app/api/auth/login/route.ts`):**

1. Generate `sessionId = randomUUID()` before signing the token.
2. Call `signTokenWithSession(userId, tokenVersion, sessionId)` instead of `signToken`.
3. After saving the user, push the new session to the DB:

```typescript
await User.findByIdAndUpdate(user._id, {
  $push: {
    sessions: {
      $each: [{
        sessionId,
        userAgent:  request.headers.get("user-agent") ?? "Unknown",
        ipAddress:  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                    ?? request.headers.get("x-real-ip") ?? "Unknown",
        createdAt:  new Date(),
        lastSeenAt: new Date(),
      }],
      $slice: -10,   // keep newest 10
    },
  },
});
```

**`verifyAuth` changes:**

After the existing `tokenVersion` check, add a session validation step:

```typescript
// If JWT contains a sessionId, verify it exists in the sessions array
if (decoded.sessionId) {
  const user = await User.findById(decoded.userId)
    .select("tokenVersion isDisabled sessions");
  const sessionExists = user?.sessions?.some(
    (s: any) => s.sessionId === decoded.sessionId
  );
  if (!sessionExists) return null;  // session was revoked
}
```

### 3. Session `lastSeenAt` Refresh

Middleware runs in the Edge runtime and cannot import Mongoose directly. The `lastSeenAt` update is handled inside `verifyAuth` in route handlers — after the session existence check, fire a non-blocking update:

```typescript
// Inside verifyAuth, after confirming session exists:
User.findOneAndUpdate(
  { _id: decoded.userId, "sessions.sessionId": decoded.sessionId },
  { $set: { "sessions.$.lastSeenAt": new Date() } }
).catch(() => {});
// Do not await — keep request fast
```

---

## API Route Design

All routes use `verifyAuth(request)` from `lib/auth.ts`. All error responses follow the existing `{ success: false, error: string }` shape. All success responses follow `{ success: true, ... }` or return data directly.

### 4. GET /api/user/me

`lib/swr-keys.ts` currently has `profile: () => "/api/auth/me"`. This key is updated to point to `/api/user/me`. The new route returns:

```json
{
  "user": {
    "_id": "...",
    "name": "Alice",
    "email": "alice@example.com",
    "displayName": "Ali",
    "bio": "Loves splitting bills",
    "avatarUrl": "https://res.cloudinary.com/...",
    "preferences": {
      "currency": "USD",
      "splitMethod": "equal",
      "timezone": "UTC"
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "isAdmin": false
  }
}
```

### 5. PATCH /api/user/me

Validates with Zod. Updates using dot-notation `$set` keys to avoid overwriting unrelated preference fields:

```typescript
const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).trim().optional(),
  bio:         z.string().max(200).trim().optional(),
  preferences: z.object({
    currency:    z.enum(["USD", "TZS", "KES", "INR", "GBP", "EUR"]).optional(),
    splitMethod: z.enum(["equal", "percent", "exact"]).optional(),
    timezone:    z.string().max(50).optional(),
  }).optional(),
});
```

Build `updateFields` by iterating parsed data and using keys like `preferences.currency` to avoid overwriting the entire preferences sub-document.

### 6. POST /api/user/avatar

- Accepts `multipart/form-data` with a `file` field.
- Validates: MIME type in `{image/jpeg, image/jpg, image/png, image/webp}`, size ≤ 5 MB.
- Uploads to Cloudinary: `folder: "spliteasy/avatars"`, `public_id: "user_${userId}"`, `overwrite: true`, transformation `[{ width: 256, height: 256, crop: "fill", gravity: "face" }, { quality: "auto", fetch_format: "auto" }]`.
- Stores `result.secure_url` as `avatarUrl` on the User document.
- Uses `checkRateLimit(request, "upload")` from `lib/rate-limit.ts`.

### 7. DELETE /api/user/avatar

- Sets `avatarUrl: null` on the User document.
- Calls `cloudinary.uploader.destroy("spliteasy/avatars/user_${userId}")` in a try/catch (non-fatal if it fails).

### 8. POST /api/user/change-password

Flow:
1. Validate `currentPassword` (min 1 char) and `newPassword` (min 8, max 128) with Zod. Refine: `currentPassword !== newPassword`.
2. Fetch user with `.select("+password")`.
3. `bcrypt.compare(currentPassword, user.password)` — return 400 `"Current password is incorrect"` on mismatch.
4. `bcrypt.hash(newPassword, 12)`.
5. Single update: `{ $set: { password: newHash, sessions: [] }, $inc: { tokenVersion: 1 } }`.
6. Clear `authToken` cookie in response.
7. Return `{ success: true, message: "Password changed. You have been signed out of all devices." }`.

### 9. POST /api/user/change-email

Flow:
1. Validate `newEmail` (email, lowercased) and `currentPassword` (min 1) with Zod.
2. Fetch user with `.select("+password email")`.
3. `bcrypt.compare(currentPassword, user.password)` — return 400 `"Password is incorrect"` on mismatch.
4. If `newEmail === user.email` — return 400 `"New email must be different from current email"`.
5. `User.findOne({ email: newEmail })` — return 409 `"Email is already in use"` if found.
6. `token = randomBytes(32).toString("hex")`, `expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)`.
7. Store `pendingEmail`, `pendingEmailToken`, `pendingEmailTokenExpiry` on user.
8. Send verification email to `newEmail` with link `${NEXT_PUBLIC_APP_URL}/api/user/verify-email?token=${token}`.
9. In development: log URL and include in response for testing.

### 10. GET /api/user/verify-email

- Reads `token` from `searchParams`.
- Finds user: `{ pendingEmailToken: token, pendingEmailTokenExpiry: { $gt: new Date() } }`. Note: `pendingEmailToken` has `select: false` in schema — use `.select("+pendingEmailToken +pendingEmailTokenExpiry +pendingEmail")`.
- If not found: redirect to `/settings?error=expired-token`.
- Apply change: `{ $set: { email: user.pendingEmail, pendingEmail: null, pendingEmailToken: null, pendingEmailTokenExpiry: null, sessions: [] }, $inc: { tokenVersion: 1 } }`.
- Clear `authToken` cookie via `NextResponse.redirect` with `cookies.delete`.
- Redirect to `/settings?success=email-changed`.

### 11. GET /api/user/sessions

- Decode JWT via `verifyToken(getTokenFromRequest(request))` to get `sessionId`.
- Return sessions with `isCurrent: s.sessionId === decoded.sessionId`.
- Sort: current first, then by `lastSeenAt` descending.

### 12. DELETE /api/user/sessions/[sessionId]

- Decode JWT to get current `sessionId`.
- Return 400 `"Cannot revoke the current session"` if `params.sessionId === decoded.sessionId`.
- `User.findByIdAndUpdate(userId, { $pull: { sessions: { sessionId: params.sessionId } } })`.

### 13. DELETE /api/user/sessions/all

- Decode JWT to get current `sessionId`.
- Fetch user sessions, find the current session object.
- `User.findByIdAndUpdate(userId, { $set: { sessions: currentSession ? [currentSession] : [] } })`.

### 14. POST /api/user/export

- `Promise.all` to fetch: User (excluding `password`, `loginAttempts`, `lockUntil`, `tokenVersion`, `passwordResetToken`, `passwordResetExpires`), Groups where `members` includes `userId`, Expenses where `paidBy === userId` or `splits.user === userId`, Settlements where `fromUser === userId` or `toUser === userId`.
- Return `new NextResponse(JSON.stringify(exportData, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=\"spliteasy-export.json\"" } })`.

### 15. DELETE /api/user/account

Flow:
1. Validate `password` (min 1) and `confirmText` (must be literal `"DELETE MY ACCOUNT"`) with Zod.
2. Fetch user with `.select("+password")`.
3. `bcrypt.compare(password, user.password)` — return 400 `"Incorrect password"` on mismatch.
4. `Group.updateMany({ members: userId }, { $pull: { members: userId } })`.
5. `Expense.updateMany({ paidBy: userId }, { $set: { paidBy: null, paidByDeleted: true } })`.
6. `User.findByIdAndDelete(userId)`.
7. `cloudinary.uploader.destroy("spliteasy/avatars/user_${userId}")` in try/catch (non-fatal).
8. Clear `authToken` cookie.
9. Return `{ success: true }`.

---

## Component Design

### 16. UserAvatar (`components/ui/UserAvatar.tsx`)

```typescript
interface UserAvatarProps {
  name:       string;
  avatarUrl?: string | null;
  size?:      number;        // pixel size, default 32
  className?: string;
}
```

**Behavior:**
- `avatarUrl` truthy: render `<img src={avatarUrl} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />`.
- `avatarUrl` falsy: render `<div style={{ width: size, height: size, background: getAvatarColor(name), fontSize: Math.floor(size * 0.38) }} className="rounded-full flex items-center justify-center text-white font-medium select-none">`.

**Color generation (deterministic hash):**

```typescript
const AVATAR_COLORS = [
  "#134E4A", "#3B0764", "#1E3A5F", "#78350F",
  "#4C1D95", "#065F46", "#1E1B4B", "#7C2D12",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
```

**Initials:** `name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)`.

### 17. SettingsClient (`components/settings/SettingsClient.tsx`)

- `"use client"` component.
- `useState<Tab>` for active tab, initialized from `initialTab` prop.
- On tab switch: `router.replace("/settings?tab=${key}", { scroll: false })`.
- Tab bar: `<div className="flex overflow-x-auto gap-1 pb-1 -mx-1 px-1">` — horizontal scroll on mobile, no wrapping.
- Renders success/error banners from `successMessage` / `errorMessage` props.
- Tab content: conditional rendering with `{tab === "profile" && <ProfileTab />}` pattern.

### 18. ProfileTab (`components/settings/ProfileTab.tsx`)

- `useSWR(keys.profile())` for user data.
- `useEffect` to sync local state when SWR data loads (handles the case where SWR resolves after initial render).
- Hidden `<input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />`.
- On upload/remove success: `mutate(keys.profile())`.
- Save: PATCH to `/api/user/me`, then `mutate(keys.profile())`.
- Skeleton loading state while `isLoading`.

### 19. PasswordTab (`components/settings/PasswordTab.tsx`)

**Strength scoring:**

```
score 0: empty string
score 1: length < 6 → "Too short" (red #F43F5E)
score 2: length >= 6, 0 extra categories → "Weak" (amber #F59E0B)
score 3: 1 extra category (upper/number/special) → "Fair" (amber #F59E0B)
score 4: 2 extra categories → "Good" (green #10B981)
score 5: 3 extra categories → "Strong" (green #10B981)
```

- Submit disabled if `strength.score < 2` OR `newPass !== confirm` OR any field empty.
- On success: show success state, then `window.location.href = "/login?message=password-changed"` after 2500ms.

### 20. EmailTab (`components/settings/EmailTab.tsx`)

- Reads current email from `useSWR(keys.profile())`.
- Displays current email as `<p>` (read-only).
- Form: `newEmail` + `currentPassword` inputs.
- On success: show inline confirmation, do not redirect.
- On error: show inline error message.

### 21. NotificationsTab (`components/settings/NotificationsTab.tsx`)

Thin wrapper — no new logic:

```tsx
import { NotificationPreferences } from "./NotificationPreferences";
import { EmailNotificationPreferences } from "./EmailNotificationPreferences";

export function NotificationsTab() {
  return (
    <div className="space-y-4">
      <NotificationPreferences />
      <EmailNotificationPreferences />
    </div>
  );
}
```

### 22. SessionsTab (`components/settings/SessionsTab.tsx`)

- `useSWR("/api/user/sessions")` with local `mutate` alias.
- `parseUserAgent(ua: string)`: regex-based detection of device type and browser name.
- `timeAgo(date: string)`: returns "Just now", "Xm ago", "Xh ago", "Xd ago".
- Current session: teal border, "This device" badge, no revoke button.
- Non-current sessions: X button, spinner while `revoking === sessionId`.
- "Sign out all others" button: only rendered when `sessions.length > 1`.

### 23. DangerZoneTab (`components/settings/DangerZoneTab.tsx`)

- Export: POST `/api/user/export` → `res.blob()` → `URL.createObjectURL` → programmatic `<a>` click → `URL.revokeObjectURL`.
- Delete form: `password` + `confirmText` inputs. Submit button disabled unless `confirmText === "DELETE MY ACCOUNT"` AND `password.length > 0`.
- On delete success: `router.push("/?deleted=true")`.

---

## SWR Keys Update

`lib/swr-keys.ts` — update `profile()`:

```typescript
profile: () => "/api/user/me" as const,
```

This replaces the existing `/api/auth/me` reference. All components using `keys.profile()` will automatically use the new endpoint. The existing `/api/auth/me` route can remain for backward compatibility.

---

## Avatar Propagation

### Components to Update

| Component | File | Change |
|-----------|------|--------|
| Desktop sidebar user card | `components/dashboard/DashboardSidebar.tsx` | Replace initials `<div>` with `<UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={32} />`. Add `avatarUrl` to `User` interface prop. |
| Mobile sidebar drawer | `components/dashboard/MobileSidebarDrawer.tsx` | Replace initials `<div>` with `<UserAvatar name={userName} avatarUrl={userAvatarUrl} size={40} />`. Add `userAvatarUrl?: string` prop. |
| Dashboard group cards | `components/dashboard/DashboardOverview.tsx` or `GroupCard.tsx` | Replace member initials in avatar stack with `<UserAvatar>`. |
| Balance Summary | Group detail balance component | Replace member initials with `<UserAvatar>`. |
| Who Pays Whom | Settlement suggestion component | Replace from/to initials with `<UserAvatar>`. |
| Members card | Group detail members list | Replace member initials with `<UserAvatar>`. |
| Expense cards | `components/ExpenseCard.tsx` | Add `avatarUrl?: string` to `paidBy` type. Render `<UserAvatar name={paidByName} avatarUrl={expense.paidBy.avatarUrl} size={24} />`. |
| Settlement cards | `components/SettlementCard.tsx` | Add `avatarUrl?: string` to `fromUser`/`toUser` types. Render `<UserAvatar>` for each. |
| Notification items | `components/dashboard/NotificationBell.tsx` | Replace actor initials with `<UserAvatar>`. |
| Admin users table | `components/admin/AdminUsersClient.tsx` | Replace initials with `<UserAvatar>`. |

### API Routes to Update

All routes returning user objects must include `avatarUrl`:

```typescript
// Members
.populate("members", "name email avatarUrl")

// Expense paidBy
.populate("paidBy", "name email avatarUrl")

// Settlements
.populate("fromUser", "name email avatarUrl")
.populate("toUser",   "name email avatarUrl")
```

Affected routes:
- `GET /api/groups/[groupId]`
- `GET /api/groups/[groupId]/members`
- `GET /api/groups/[groupId]/balances`
- `GET /api/groups/[groupId]/settle`
- `GET /api/expenses?groupId=...`
- `GET /api/expenses/mine`
- `GET /api/settlements/mine`
- `GET /api/notifications`

---

## Default Preferences in Add Expense

In `components/dashboard/AddExpenseWizard.tsx`:

```typescript
const { data: profileData } = useSWR(keys.profile());

// Priority: group currency > user preference > "USD"
const [currency, setCurrency] = useState(
  group?.currency ?? profileData?.user?.preferences?.currency ?? "USD"
);
const [splitType, setSplitType] = useState(
  profileData?.user?.preferences?.splitMethod ?? "equal"
);

// Sync when profile data loads (SWR may resolve after initial render)
useEffect(() => {
  if (!group?.currency && profileData?.user?.preferences?.currency) {
    setCurrency(profileData.user.preferences.currency);
  }
  if (profileData?.user?.preferences?.splitMethod) {
    setSplitType(profileData.user.preferences.splitMethod);
  }
}, [profileData, group?.currency]);
```

---

## Settings Page Server Component

`app/(dashboard)/settings/page.tsx` is converted from a client component to a server component:

```typescript
import { verifyAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata = { title: "Settings — SplitEasy" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; success?: string; error?: string };
}) {
  const userId = await verifyAuth();
  if (!userId) redirect("/login");

  return (
    <SettingsClient
      initialTab={searchParams.tab ?? "profile"}
      successMessage={searchParams.success}
      errorMessage={searchParams.error}
    />
  );
}
```

---

## Correctness Properties

The following properties must hold and are suitable for property-based testing:

### P1: Session Array Bounded
For any sequence of logins, `user.sessions.length <= 10` always holds. Adding an 11th session must remove the oldest.

### P2: TokenVersion Monotonically Increases
After a password change or email verification, `user.tokenVersion` is strictly greater than its previous value. It never decreases.

### P3: Revoked Session Rejected
If a session `S` is removed from `user.sessions`, any JWT containing `sessionId = S.sessionId` must be rejected by `verifyAuth` with a 401.

### P4: Password Change Clears All Sessions
After a successful password change, `user.sessions` is empty and `user.tokenVersion` has been incremented by exactly 1.

### P5: Avatar Color Determinism
For any string `name`, `getAvatarColor(name)` always returns the same color. The same name never produces different colors across renders or calls.

### P6: Confirmation Text Case-Sensitive
Account deletion only succeeds when `confirmText === "DELETE MY ACCOUNT"` exactly. Any other string — including lowercase, extra spaces, or partial matches — must be rejected with a 400.

### P7: Pending Email Token Expiry
A `pendingEmailToken` with `pendingEmailTokenExpiry < Date.now()` must be rejected by the verify-email endpoint. The user's email must not change.

### P8: Export Completeness
The data export response must include all four top-level keys: `profile`, `groups`, `expenses`, `settlements`. None may be absent even if the user has no groups, expenses, or settlements.

---

## File Change Summary

### Create
- `app/api/user/me/route.ts`
- `app/api/user/avatar/route.ts`
- `app/api/user/change-password/route.ts`
- `app/api/user/change-email/route.ts`
- `app/api/user/verify-email/route.ts`
- `app/api/user/sessions/route.ts`
- `app/api/user/sessions/[sessionId]/route.ts`
- `app/api/user/sessions/all/route.ts`
- `app/api/user/export/route.ts`
- `app/api/user/account/route.ts`
- `components/ui/UserAvatar.tsx`
- `components/settings/SettingsClient.tsx`
- `components/settings/ProfileTab.tsx`
- `components/settings/PasswordTab.tsx`
- `components/settings/EmailTab.tsx`
- `components/settings/NotificationsTab.tsx`
- `components/settings/SessionsTab.tsx`
- `components/settings/DangerZoneTab.tsx`

### Modify
- `lib/models/User.ts` — schema + interface extensions
- `lib/auth.ts` — `signTokenWithSession`, `verifyAuth` session check + lastSeenAt refresh
- `app/api/auth/login/route.ts` — generate sessionId, store session in DB
- `app/(dashboard)/settings/page.tsx` — convert to server component, render SettingsClient
- `lib/swr-keys.ts` — update `profile()` to `/api/user/me`
- `components/dashboard/DashboardSidebar.tsx` — UserAvatar in user card
- `components/dashboard/MobileSidebarDrawer.tsx` — UserAvatar + new `userAvatarUrl` prop
- `components/ExpenseCard.tsx` — `avatarUrl` in `paidBy` type + UserAvatar
- `components/SettlementCard.tsx` — `avatarUrl` in `fromUser`/`toUser` types + UserAvatar
- `components/dashboard/NotificationBell.tsx` — UserAvatar for actor
- `components/admin/AdminUsersClient.tsx` — UserAvatar in table
- `components/dashboard/AddExpenseWizard.tsx` — default currency + split method from preferences
- All group/expense/settlement API routes — add `avatarUrl` to `.populate()` / `.select()`
