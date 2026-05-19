# Implementation Tasks

## Task List

- [x] 1. Extend User data model
  - [x] 1.1 Add profile fields to `IUser` interface: `avatarUrl`, `bio`, `displayName`
  - [x] 1.2 Add `preferences` sub-document to `IUser` interface: `currency`, `splitMethod`, `timezone`
  - [x] 1.3 Add email-change flow fields to `IUser` interface: `pendingEmail`, `pendingEmailToken`, `pendingEmailTokenExpiry`
  - [x] 1.4 Add `sessions` array type to `IUser` interface with `sessionId`, `userAgent`, `ipAddress`, `createdAt`, `lastSeenAt`, `isCurrent`
  - [x] 1.5 Add account lifecycle fields to `IUser` interface: `deletionRequestedAt`, `dataExportToken`, `dataExportExpiry`
  - [x] 1.6 Add all new fields to the Mongoose `UserSchema` with correct types, defaults, and constraints (including `select: false` on `pendingEmailToken`)

- [x] 2. Write PBT property tests for data model and core logic
  - [x] 2.1 Write property test P1: session array is always bounded to ≤ 10 entries after any number of push operations with `$slice: -10`
  - [x] 2.2 Write property test P2: `tokenVersion` strictly increases after password change or email verification (never decreases)
  - [x] 2.3 Write property test P5: `getAvatarColor(name)` is deterministic — same input always returns same color from the fixed palette
  - [x] 2.4 Write property test P6: account deletion rejects any `confirmText` that is not exactly `"DELETE MY ACCOUNT"` (case-sensitive, no extra spaces)
  - [x] 2.5 Write property test P7: verify-email endpoint rejects tokens where `pendingEmailTokenExpiry < Date.now()`
  - [x] 2.6 Write property test P8: data export response always contains all four top-level keys (`profile`, `groups`, `expenses`, `settlements`) regardless of whether the user has any data

- [x] 3. Update authentication layer for session-aware JWTs
  - [x] 3.1 Add `signTokenWithSession(userId, tokenVersion, sessionId)` function to `lib/auth.ts`
  - [x] 3.2 Update `verifyToken` return type in `lib/auth.ts` to include optional `sessionId?: string`
  - [x] 3.3 Update `verifyAuth` in `lib/auth.ts` to check that `decoded.sessionId` exists in `user.sessions` array; return `null` if session not found (revoked)
  - [x] 3.4 Add fire-and-forget `lastSeenAt` refresh inside `verifyAuth` after session existence is confirmed
  - [x] 3.5 Update `app/api/auth/login/route.ts` to generate `sessionId = randomUUID()`, call `signTokenWithSession`, and push the new session record to the DB with `$push/$each/$slice: -10`

- [x] 4. Write PBT property tests for session authentication
  - [x] 4.1 Write property test P3: a JWT whose `sessionId` has been removed from `user.sessions` must be rejected by `verifyAuth` with a null return (simulating 401)
  - [x] 4.2 Write property test P4: after a successful password change, `user.sessions` is empty and `user.tokenVersion` has been incremented by exactly 1

- [x] 5. Create profile API routes (`/api/user/me`)
  - [x] 5.1 Create `app/api/user/me/route.ts` with `GET` handler: authenticate, fetch user with new fields selected, return `{ user }` shape
  - [x] 5.2 Add `PATCH` handler to `app/api/user/me/route.ts`: validate with `UpdateProfileSchema` (Zod), build dot-notation `updateFields`, call `findByIdAndUpdate` with `$set`, return updated user
  - [x] 5.3 Update `lib/swr-keys.ts`: change `profile()` from `"/api/auth/me"` to `"/api/user/me"`

- [x] 6. Create avatar API route (`/api/user/avatar`)
  - [x] 6.1 Create `app/api/user/avatar/route.ts` with `POST` handler: authenticate, rate-limit, validate file type and size, upload to Cloudinary with face-aware 256×256 crop, store `avatarUrl` on user, return `{ avatarUrl }`
  - [x] 6.2 Add `DELETE` handler to `app/api/user/avatar/route.ts`: authenticate, set `avatarUrl: null` on user, destroy Cloudinary asset in try/catch, return `{ success: true }`

- [x] 7. Create password change API route (`/api/user/change-password`)
  - [x] 7.1 Create `app/api/user/change-password/route.ts` with `POST` handler: authenticate, rate-limit, validate with Zod (min 8 chars, current ≠ new), verify current password with bcrypt, hash new password, update user with `{ $set: { password, sessions: [] }, $inc: { tokenVersion: 1 } }`, clear `authToken` cookie, return success

- [x] 8. Create email change API routes (`/api/user/change-email` and `/api/user/verify-email`)
  - [x] 8.1 Create `app/api/user/change-email/route.ts` with `POST` handler: authenticate, rate-limit, validate `newEmail` and `currentPassword`, verify password, check email not same and not taken, store `pendingEmail`/`pendingEmailToken`/`pendingEmailTokenExpiry`, send verification email (log URL in dev), return success
  - [x] 8.2 Create `app/api/user/verify-email/route.ts` with `GET` handler: read `token` from query, find user with matching non-expired token (using `+pendingEmailToken` select), apply email change with `$set/$inc`, clear `authToken` cookie, redirect to `/settings?success=email-changed` or `/settings?error=expired-token`

- [x] 9. Create session management API routes
  - [x] 9.1 Create `app/api/user/sessions/route.ts` with `GET` handler: authenticate, decode JWT to get current `sessionId`, return sessions array with `isCurrent` flag, sorted (current first, then by `lastSeenAt` desc)
  - [x] 9.2 Create `app/api/user/sessions/[sessionId]/route.ts` with `DELETE` handler: authenticate, reject if `params.sessionId === decoded.sessionId`, pull session from array, return success
  - [x] 9.3 Create `app/api/user/sessions/all/route.ts` with `DELETE` handler: authenticate, find current session object, set `sessions` to array containing only the current session, return success

- [x] 10. Create data export API route (`/api/user/export`)
  - [x] 10.1 Create `app/api/user/export/route.ts` with `POST` handler: authenticate, gather user profile (excluding sensitive fields), groups, expenses, and settlements via `Promise.all`, return `NextResponse` with JSON body and `Content-Disposition: attachment` header

- [x] 11. Create account deletion API route (`/api/user/account`)
  - [x] 11.1 Create `app/api/user/account/route.ts` with `DELETE` handler: authenticate, validate `password` and `confirmText === "DELETE MY ACCOUNT"` with Zod literal, verify password with bcrypt, remove user from groups, anonymize expenses, delete user document, destroy Cloudinary avatar in try/catch, clear `authToken` cookie, return success

- [x] 12. Create `UserAvatar` component
  - [x] 12.1 Create `components/ui/UserAvatar.tsx`: implement `getAvatarColor(name)` with the 8-color deterministic hash, compute initials (up to 2 chars), render `<img>` when `avatarUrl` is truthy, render colored initials `<div>` when falsy, support `size` prop (default 32) and `className` prop

- [x] 13. Build Settings page shell and SettingsClient
  - [x] 13.1 Convert `app/(dashboard)/settings/page.tsx` to an async server component: call `verifyAuth()`, redirect to `/login` if unauthenticated, render `<SettingsClient>` with `initialTab`, `successMessage`, `errorMessage` from `searchParams`
  - [x] 13.2 Create `components/settings/SettingsClient.tsx`: define 6 tabs (profile, password, email, notifications, sessions, danger), manage active tab with `useState`, sync tab to URL with `router.replace`, render horizontally-scrollable tab bar, render success/error banners, conditionally render each tab component

- [x] 14. Build ProfileTab
  - [x] 14.1 Create `components/settings/ProfileTab.tsx`: fetch profile with `useSWR(keys.profile())`, sync local state via `useEffect`, render `UserAvatar` with upload/remove controls (hidden file input, visible button), render `displayName` and `bio` inputs, render currency and split method selectors, save via PATCH to `/api/user/me` with `mutate(keys.profile())` on success, show skeleton while loading

- [x] 15. Build PasswordTab
  - [x] 15.1 Create `components/settings/PasswordTab.tsx`: render three password fields with show/hide toggles, implement `getStrength(password)` scoring function (5 levels), render animated strength bar, disable submit when strength < 2 or passwords mismatch or fields empty, POST to `/api/user/change-password`, show success state then redirect to `/login?message=password-changed` after 2500ms, show inline errors

- [x] 16. Build EmailTab
  - [x] 16.1 Create `components/settings/EmailTab.tsx`: fetch current email from `useSWR(keys.profile())`, display as read-only text, render `newEmail` and `currentPassword` inputs, POST to `/api/user/change-email`, show inline confirmation on success, show inline error on failure

- [x] 17. Build NotificationsTab
  - [x] 17.1 Create `components/settings/NotificationsTab.tsx`: render `<NotificationPreferences />` and `<EmailNotificationPreferences />` from existing components in a `space-y-4` wrapper

- [x] 18. Build SessionsTab
  - [x] 18.1 Create `components/settings/SessionsTab.tsx`: fetch sessions with `useSWR("/api/user/sessions")`, implement `parseUserAgent(ua)` and `timeAgo(date)` helpers, render each session with device icon, IP, timestamps, "This device" badge for current session, revoke button (X) for non-current sessions with per-session loading state, "Sign out all others" button when `sessions.length > 1`, skeleton loading state

- [x] 19. Build DangerZoneTab
  - [x] 19.1 Create `components/settings/DangerZoneTab.tsx`: render data export section with download button (POST → blob → programmatic anchor click), render account deletion form with `password` and `confirmText` inputs, disable delete button unless `confirmText === "DELETE MY ACCOUNT"` and password non-empty, DELETE to `/api/user/account`, redirect to `/?deleted=true` on success, show inline errors

- [x] 20. Wire `UserAvatar` throughout the app
  - [x] 20.1 Update `components/dashboard/DashboardSidebar.tsx`: add `avatarUrl?: string` to `User` interface prop, replace initials `<div>` in user card with `<UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={32} />`
  - [x] 20.2 Update `components/dashboard/MobileSidebarDrawer.tsx`: add `userAvatarUrl?: string` prop, replace initials `<div>` with `<UserAvatar name={userName} avatarUrl={userAvatarUrl} size={40} />`
  - [x] 20.3 Update `components/ExpenseCard.tsx`: add `avatarUrl?: string` to `paidBy` type in `ExpenseCardItem`, render `<UserAvatar>` next to "Paid by" name
  - [x] 20.4 Update `components/SettlementCard.tsx`: add `avatarUrl?: string` to `fromUser` and `toUser` types, render `<UserAvatar>` for each user
  - [x] 20.5 Update `components/dashboard/NotificationBell.tsx`: replace actor initials circle with `<UserAvatar>`
  - [x] 20.6 Update `components/admin/AdminUsersClient.tsx`: replace initials circle in users table with `<UserAvatar>`
  - [x] 20.7 Update group detail components (Balance Summary, Who Pays Whom, Members card): replace all initials circles with `<UserAvatar>`
  - [x] 20.8 Update Dashboard group cards (`DashboardOverview.tsx` or `GroupCard.tsx`): replace member initials in avatar stack with `<UserAvatar>`

- [x] 21. Add `avatarUrl` to API populate/select calls
  - [x] 21.1 Update all group API routes that call `.populate("members", ...)` to include `avatarUrl` in the field list
  - [x] 21.2 Update all expense API routes that call `.populate("paidBy", ...)` to include `avatarUrl`
  - [x] 21.3 Update all settlement API routes that call `.populate("fromUser", ...)` and `.populate("toUser", ...)` to include `avatarUrl`
  - [x] 21.4 Update the notifications API route to include `avatarUrl` for actor user references

- [x] 22. Wire default preferences into Add Expense
  - [x] 22.1 Update `components/dashboard/AddExpenseWizard.tsx`: add `useSWR(keys.profile())`, initialize `currency` state with priority `group?.currency ?? profileData?.user?.preferences?.currency ?? "USD"`, initialize `splitType` state with `profileData?.user?.preferences?.splitMethod ?? "equal"`, add `useEffect` to sync both values when `profileData` loads
