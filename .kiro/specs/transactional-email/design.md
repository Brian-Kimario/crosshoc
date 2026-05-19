# Design Document: Transactional Email

## Overview

This feature adds a comprehensive transactional email system to SplitEasy using [Resend](https://resend.com) as the delivery provider and [React Email](https://react.email) for template authoring.

The central utility is `lib/email.ts`, which exports a `sendEmail()` function that mirrors the fire-and-forget pattern of the existing `notify()` in `lib/notify.ts` — it never throws and never crashes the calling operation. All 16 email templates live in `emails/` as React Email `.tsx` components sharing a common `EmailLayout` wrapper.

The feature also delivers the forgot-password flow (two new API routes + two new UI pages), extends the User model with `passwordResetToken`, `passwordResetExpires`, and `emailPrefs` fields, extends the InviteToken model with `expiringSoonEmailSentAt`, and adds a new `GET /api/cron/invite-expiring` route that replaces the existing in-app-only invite-expiry cron with one that also sends email.

**Key design principle:** Email is a durable, out-of-band channel for events that matter when the user is offline, locked out, or when the action is irreversible. In-app notifications (`lib/notify.ts`) remain the primary channel for events visible to active users. The two systems are complementary and independent — a failure in either must never affect the other.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  API Routes / Cron Routes                                       │
│  (register, login, admin/*, settings, cron/invite-expiring)     │
│                          │                                      │
│                          ▼                                      │
│              lib/email.ts  sendEmail()                          │
│              ┌────────────────────────────────┐                 │
│              │  1. Check emailPrefs (if user) │                 │
│              │  2. Check RESEND_API_KEY        │                 │
│              │  3. Render React Email template │                 │
│              │  4. Call Resend SDK             │                 │
│              │  5. Catch all errors → log only │                 │
│              └────────────────────────────────┘                 │
│                          │                                      │
│                          ▼                                      │
│              Resend API (external)                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  emails/ directory                                              │
│  ├── components/EmailLayout.tsx   (shared wrapper)             │
│  ├── WelcomeEmail.tsx                                           │
│  ├── ForgotPasswordEmail.tsx                                    │
│  ├── PasswordChangedEmail.tsx                                   │
│  ├── EmailChangedEmail.tsx                                      │
│  ├── AccountDisabledEmail.tsx                                   │
│  ├── AccountReEnabledEmail.tsx                                  │
│  ├── AccountDeletedEmail.tsx                                    │
│  ├── AdminTriggeredResetEmail.tsx                               │
│  ├── NewLoginEmail.tsx                                          │
│  ├── AccountLockedEmail.tsx                                     │
│  ├── RemovedFromGroupEmail.tsx                                  │
│  ├── GroupDeletedEmail.tsx                                      │
│  ├── GroupInviteEmail.tsx                                       │
│  ├── InviteExpiringSoonEmail.tsx                                │
│  ├── ExpenseVoidedEmail.tsx                                     │
│  └── SettlementVoidedEmail.tsx                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

`sendEmail()` is called fire-and-forget (no `await`, wrapped in try/catch at the call site or internally) from:

| Trigger | Route / File | Template |
|---|---|---|
| User registers | `app/api/auth/register/route.ts` | `WelcomeEmail` |
| User logs in from new IP | `app/api/auth/login/route.ts` | `NewLoginEmail` |
| Account locked (max attempts) | `app/api/auth/login/route.ts` | `AccountLockedEmail` |
| Forgot password requested | `app/api/auth/forgot-password/route.ts` | `ForgotPasswordEmail` |
| Password reset completed | `app/api/auth/reset-password/route.ts` | `PasswordChangedEmail` |
| User changes own password | `app/api/user/password/route.ts` (settings) | `PasswordChangedEmail` |
| Admin updates user email | `app/api/admin/users/[userId]/profile/route.ts` | `EmailChangedEmail` |
| Admin disables user | `app/api/admin/users/[userId]/disable/route.ts` | `AccountDisabledEmail` |
| Admin re-enables user | `app/api/admin/users/[userId]/enable/route.ts` | `AccountReEnabledEmail` |
| Admin deletes user | `app/api/admin/users/[userId]/route.ts` | `AccountDeletedEmail` |
| Admin triggers password reset | `app/api/admin/users/[userId]/reset-password/route.ts` | `AdminTriggeredResetEmail` |
| Admin removes member from group | `app/api/admin/groups/[groupId]/members/[userId]/route.ts` | `RemovedFromGroupEmail` |
| Admin deletes group | `app/api/admin/groups/[groupId]/route.ts` | `GroupDeletedEmail` (×N members) |
| Admin voids expense | `app/api/admin/expenses/[expenseId]/void/route.ts` | `ExpenseVoidedEmail` (×N splits) |
| Admin voids settlement | `app/api/admin/settlements/[settlementId]/void/route.ts` | `SettlementVoidedEmail` (×2) |
| User shares invite by email | `app/api/groups/[groupId]/invite/share/route.ts` | `GroupInviteEmail` |
| Cron: invite expiring soon | `app/api/cron/invite-expiring/route.ts` | `InviteExpiringSoonEmail` |

---

## Components and Interfaces

### `lib/email.ts`

```ts
import 'server-only';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  /** Optional: userId for emailPrefs check. If omitted, prefs check is skipped. */
  userId?: string;
  /** Optional: emailPrefs key to check before sending. */
  prefsKey?: EmailPrefsKey;
}

export type EmailPrefsKey =
  | 'newLogin'
  | 'groupInvite'
  | 'inviteExpiringSoon'
  | 'expenseVoided'
  | 'settlementVoided'
  | 'removedFromGroup'
  | 'groupDeleted';

/**
 * Send a transactional email via Resend.
 * NEVER throws — email failure must never crash the calling operation.
 * No-op when RESEND_API_KEY is absent or set to the placeholder value.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  // 1. Dev/CI no-op guard
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_placeholder') {
    console.log('[email] No-op (RESEND_API_KEY not configured):', {
      to: params.to,
      subject: params.subject,
    });
    return;
  }

  // 2. emailPrefs check (opt-out)
  if (params.userId && params.prefsKey) {
    try {
      const { default: User } = await import('@/lib/models/User');
      await (await import('@/lib/db')).default();
      const user = await User.findById(params.userId).select('emailPrefs').lean() as any;
      if (user?.emailPrefs?.[params.prefsKey] === false) {
        return; // User opted out
      }
    } catch (err) {
      console.error('[email] emailPrefs check failed:', err);
      // Fail open — send the email if prefs check errors
    }
  }

  // 3. Send
  try {
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM ?? 'SplitEasy <noreply@spliteasy.app>';
    await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      react: params.react,
    });
  } catch (err) {
    console.error('[email] Send failed:', err, { to: params.to, subject: params.subject });
    // Swallow — never propagate
  }
}
```

### `POST /api/auth/forgot-password`

```ts
// Request body
{ email: string }

// Response 200 (always, even if email not found)
{ message: "If that email is registered, a reset link has been sent." }

// Response 429 — rate limit exceeded
{ error: "Too many requests", retryAfter: number }
```

**Logic:**
1. Rate-limit check (`auth` preset — 5 req / 60 s)
2. Look up user by email
3. If not found → return 200 with generic message (anti-enumeration)
4. Generate `crypto.randomBytes(32).toString('hex')` → raw token
5. Hash with `crypto.createHash('sha256').update(rawToken).digest('hex')` → stored hash
6. Set `user.passwordResetToken = hash`, `user.passwordResetExpires = Date.now() + 3600000`
7. Save user
8. Call `sendEmail()` with `ForgotPasswordEmail` containing `${NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`
9. Return 200

### `POST /api/auth/reset-password`

```ts
// Request body
{ token: string; password: string }

// Response 200
{ message: "Password reset successfully." }

// Response 400
{ error: "Invalid or expired reset token." }
```

**Logic:**
1. Hash submitted token with SHA-256
2. Find user where `passwordResetToken === hash` AND `passwordResetExpires > Date.now()`
3. If not found → return 400 with generic message
4. Hash new password with `hashPassword()` from `lib/auth.ts`
5. Update user: `password = newHash`, `passwordResetToken = null`, `passwordResetExpires = null`, `tokenVersion += 1`
6. Save user
7. Call `sendEmail()` with `PasswordChangedEmail` (security-critical, no prefs check)
8. Return 200

### `GET /api/cron/invite-expiring`

```ts
// Authorization: Bearer ${CRON_SECRET}
// Response 200
{ processed: number }
// Response 403
{ error: "Forbidden" }
```

**Logic:**
1. Verify `Authorization: Bearer <CRON_SECRET>` header (consistent with security-hardening spec pattern)
2. Query InviteToken where:
   - `expiresAt` between `now` and `now + 6h`
   - `usedAt` is null (for single-use tokens) OR `multiUse: true` (not yet expired)
   - `expiringSoonEmailSentAt` is null
3. For each token: look up group and creator user, call `sendEmail()` with `InviteExpiringSoonEmail`
4. Set `token.expiringSoonEmailSentAt = new Date()` and save
5. Return `{ processed: count }`

**Vercel cron config** (`vercel.json`):
```json
{ "path": "/api/cron/invite-expiring", "schedule": "0 * * * *" }
```

### `app/(auth)/forgot-password/page.tsx`

Client component. Renders an email input form. On submit, calls `POST /api/auth/forgot-password`. On success, shows a confirmation message ("Check your email for a reset link"). Matches the visual style of the existing login/register pages (dark theme, `AuthLayout`, `AuthBrandPanel`, teal accent).

### `app/(auth)/reset-password/page.tsx`

Client component. Reads `?token=` from URL query params via `useSearchParams()`. Renders a new-password form. On submit, calls `POST /api/auth/reset-password` with the token and new password. On success, redirects to `/login` with a success message. On error, shows the generic invalid/expired message.

### `emails/components/EmailLayout.tsx`

Shared wrapper used by all 16 templates. Provides:
- `<Html lang="en">` root
- `<Head>` with charset and viewport meta
- Dark-themed `<Body>` with `#0F172A` background
- Centered `<Container>` (max-width 600px)
- Header: SplitEasy logo/wordmark in teal (`#10B981`)
- Footer: app name, support link (`SUPPORT_EMAIL`), and a note that this is a transactional email

Props: `{ children: ReactNode; previewText: string }`

---

## Data Models

### User Model Changes (`lib/models/User.ts`)

Add to `IUser` interface:
```ts
passwordResetToken?: string | null;
passwordResetExpires?: Date | null;
emailPrefs?: {
  newLogin?: boolean;
  groupInvite?: boolean;
  inviteExpiringSoon?: boolean;
  expenseVoided?: boolean;
  settlementVoided?: boolean;
  removedFromGroup?: boolean;
  groupDeleted?: boolean;
};
```

Add to `UserSchema`:
```ts
passwordResetToken: {
  type: String,
  default: null,
  select: false,   // never returned in queries unless explicitly selected
},
passwordResetExpires: {
  type: Date,
  default: null,
  select: false,
},
emailPrefs: {
  newLogin:             { type: Boolean, default: true },
  groupInvite:          { type: Boolean, default: true },
  inviteExpiringSoon:   { type: Boolean, default: true },
  expenseVoided:        { type: Boolean, default: true },
  settlementVoided:     { type: Boolean, default: true },
  removedFromGroup:     { type: Boolean, default: true },
  groupDeleted:         { type: Boolean, default: true },
},
```

`passwordResetToken` stores the **SHA-256 hash** of the raw token (never the raw token itself). `select: false` ensures it is never accidentally returned in user queries.

### InviteToken Model Changes (`lib/models/InviteToken.ts`)

Add to `IInviteToken` interface:
```ts
expiringSoonEmailSentAt?: Date | null;
```

Add to `InviteTokenSchema`:
```ts
expiringSoonEmailSentAt: {
  type: Date,
  default: null,
  index: true,   // queried in cron WHERE clause
},
```

### Email Templates — Props Interfaces

| Template | Props |
|---|---|
| `WelcomeEmail` | `{ name: string; dashboardUrl: string }` |
| `ForgotPasswordEmail` | `{ name: string; resetUrl: string; expiresInMinutes: number }` |
| `PasswordChangedEmail` | `{ name: string; settingsUrl: string; supportEmail: string }` |
| `EmailChangedEmail` | `{ name: string; oldEmail: string; newEmail: string; supportEmail: string }` |
| `AccountDisabledEmail` | `{ name: string; reason?: string; supportEmail: string }` |
| `AccountReEnabledEmail` | `{ name: string; dashboardUrl: string }` |
| `AccountDeletedEmail` | `{ name: string; reason?: string; supportEmail: string }` |
| `AdminTriggeredResetEmail` | `{ name: string; resetUrl: string; expiresInMinutes: number; supportEmail: string }` |
| `NewLoginEmail` | `{ name: string; loginAt: string; ipAddress: string; location?: string; settingsUrl: string; supportEmail: string }` |
| `AccountLockedEmail` | `{ name: string; lockDurationMinutes: number; forgotPasswordUrl: string }` |
| `RemovedFromGroupEmail` | `{ name: string; groupName: string; reason: string; supportEmail: string }` |
| `GroupDeletedEmail` | `{ name: string; groupName: string; reason: string; supportEmail: string }` |
| `GroupInviteEmail` | `{ recipientName?: string; inviterName: string; groupName: string; inviteUrl: string; expiresAt: string }` |
| `InviteExpiringSoonEmail` | `{ name: string; groupName: string; hoursRemaining: number; groupUrl: string }` |
| `ExpenseVoidedEmail` | `{ name: string; expenseDescription: string; amount: string; groupName: string; reason: string; supportEmail: string }` |
| `SettlementVoidedEmail` | `{ name: string; amount: string; groupName: string; fromUserName: string; toUserName: string; reason: string; supportEmail: string }` |

All monetary `amount` props are pre-formatted strings (e.g., `"$12.50"`) — formatting happens at the call site using the group's currency, not inside the template.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: sendEmail() never throws

*For any* `SendEmailParams` value — including params with invalid email addresses, empty subjects, or arbitrary React elements — calling `sendEmail()` must return a resolved Promise and must never throw or reject, regardless of whether the Resend API call succeeds or fails.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: sendEmail() is a no-op when RESEND_API_KEY is absent or placeholder

*For any* `SendEmailParams`, when `RESEND_API_KEY` is absent or equal to `"re_placeholder"`, calling `sendEmail()` must not make any network call to Resend and must resolve immediately.

**Validates: Requirements 1.4, 10.1**

---

### Property 3: Forgot-password token is stored as a hash, not plaintext

*For any* valid user email, after calling `POST /api/auth/forgot-password`, the `passwordResetToken` field stored on the User document must equal the SHA-256 hash of the raw token included in the emailed link, and must not equal the raw token itself.

**Validates: Requirements 2.2**

---

### Property 4: Password reset succeeds for valid tokens and fails for invalid ones

*For any* valid (non-expired, matching) reset token and new password, `POST /api/auth/reset-password` must update the user's password, clear `passwordResetToken` and `passwordResetExpires`, and increment `tokenVersion`. *For any* invalid token (wrong value or expired), the endpoint must return HTTP 400 and leave the password unchanged.

**Validates: Requirements 2.5, 2.6**

---

### Property 5: Forgot-password returns HTTP 200 for both found and not-found emails

*For any* email address — whether or not it exists in the database — `POST /api/auth/forgot-password` must return HTTP 200 with the same generic success message, to prevent account enumeration.

**Validates: Requirements 2.3**

---

### Property 6: sendEmail() respects opt-out emailPrefs

*For any* user with a specific `emailPrefs` toggle explicitly set to `false`, calling `sendEmail()` with the corresponding `prefsKey` must not deliver the email (Resend must not be called for that recipient/type combination).

**Validates: Requirements 9.2**

---

### Property 7: Security-critical emails are always sent regardless of emailPrefs

*For any* user with all `emailPrefs` toggles set to `false`, security-critical emails (`ForgotPasswordEmail`, `PasswordChangedEmail`, `EmailChangedEmail`, `AccountDisabledEmail`, `AccountReEnabledEmail`, `AccountDeletedEmail`, `AdminTriggeredResetEmail`, `AccountLockedEmail`) must still be delivered — these are called without a `prefsKey` and bypass the prefs check entirely.

**Validates: Requirements 9.3**

---

### Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set

*For any* user with `lastLoginIp` set, logging in from a different IP must trigger `sendEmail()` with `NewLoginEmail`. *For any* user with `lastLoginIp` not set (first login), or logging in from the same IP, `sendEmail()` must not be called with `NewLoginEmail`.

**Validates: Requirements 4.1, 4.3, 4.4**

---

### Property 9: Admin group-delete sends one GroupDeletedEmail per member

*For any* group with N members, an admin delete-group operation must result in exactly N `sendEmail()` calls with the `GroupDeletedEmail` template — one per member at the time of deletion.

**Validates: Requirements 5.2**

---

### Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry

*For any* expense with N entries in its `splits` array, an admin void-expense operation must result in exactly N `sendEmail()` calls with the `ExpenseVoidedEmail` template.

**Validates: Requirements 6.1**

---

### Property 11: Cron sets expiringSoonEmailSentAt after processing each token

*For any* qualifying InviteToken processed by the cron route, after the route completes, `expiringSoonEmailSentAt` must be set to a non-null Date on that token document, preventing duplicate sends on subsequent cron runs.

**Validates: Requirements 8.3, 5.6**

---

### Property 12: Templates render monetary amounts in human-readable format

*For any* template that accepts an `amount` prop, the rendered HTML output must contain the amount in human-readable format (e.g., `"$12.50"`) and must not contain the raw integer cent value (e.g., `"1250"` alone without currency symbol and decimal).

**Validates: Requirements 7.6**

---

### Property 13: Templates include a plain-text fallback URL below every action button

*For any* template that renders an action button (e.g., reset password, view group), the rendered HTML output must also contain the button's URL as a plain-text link, so that email clients that block buttons can still access the action.

**Validates: Requirements 7.7**

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Resend API call fails (any reason) | `sendEmail()` catches, logs via `console.error`, resolves — calling operation unaffected |
| `RESEND_API_KEY` absent or placeholder | `sendEmail()` logs via `console.log`, returns immediately — no network call |
| `emailPrefs` DB lookup fails | Fail open — email is sent; error logged via `console.error` |
| `POST /api/auth/forgot-password` — email not found | HTTP 200 with generic message (anti-enumeration) |
| `POST /api/auth/forgot-password` — rate limit exceeded | HTTP 429 with `Retry-After` header |
| `POST /api/auth/reset-password` — token invalid or expired | HTTP 400 `{ error: "Invalid or expired reset token." }` — password unchanged |
| `POST /api/auth/reset-password` — missing fields | HTTP 400 `{ error: "token and password are required" }` |
| `GET /api/cron/invite-expiring` — wrong/missing CRON_SECRET | HTTP 403 `{ error: "Forbidden" }` |
| `GET /api/cron/invite-expiring` — sendEmail() fails for one token | Error logged; cron continues processing remaining tokens |
| Template rendering error | Caught inside `sendEmail()`, logged, resolved — no crash |

All `sendEmail()` calls in API routes are fire-and-forget: they are not awaited at the call site (or are wrapped in a void expression), so a slow or failing email send never adds latency to the HTTP response.

---

## Testing Strategy

### Unit Tests

Example-based unit tests cover:

- `lib/email.ts`: no-op behavior when `RESEND_API_KEY` is absent; correct `from` address selection; `emailPrefs` opt-out skips send; security-critical emails bypass prefs check
- `POST /api/auth/forgot-password`: returns 200 for non-existent email; stores hashed token (not raw); sets expiry ~1 hour from now
- `POST /api/auth/reset-password`: returns 400 for expired token; returns 400 for wrong token; clears token fields on success; increments `tokenVersion` on success
- `GET /api/cron/invite-expiring`: returns 403 without correct secret; skips tokens with `expiringSoonEmailSentAt` already set
- Template rendering: each of the 16 templates renders without throwing when given valid props; `Preview` element is present in rendered output

### Property-Based Tests

Use **fast-check** (already used in the project) with a minimum of **100 iterations** per property.

Each test is tagged with a comment in the format:
`// Feature: transactional-email, Property N: <property text>`

| Property | Generator inputs | Assertion |
|---|---|---|
| P1: sendEmail() never throws | Random `SendEmailParams` (fc.string for to/subject, mock react element); Resend mock throws random errors | Promise resolves, no exception |
| P2: No-op without API key | Random `SendEmailParams`; RESEND_API_KEY unset or `"re_placeholder"` | Resend constructor never called |
| P3: Token stored as hash | Random user emails; random 32-byte tokens | `storedToken === sha256(rawToken)` and `storedToken !== rawToken` |
| P4: Reset succeeds/fails correctly | Random valid tokens + passwords; random invalid tokens | Valid: password updated, fields cleared, tokenVersion++; Invalid: HTTP 400, password unchanged |
| P5: Forgot-password anti-enumeration | Random email strings (existing and non-existing) | Always HTTP 200, same response body |
| P6: emailPrefs opt-out respected | Random users with random emailPrefs configurations; random opt-out email types | Resend not called when pref is false |
| P7: Security-critical emails bypass prefs | Random users with all prefs false; security-critical email types | Resend called regardless |
| P8: NewLoginEmail IP logic | Random users with/without lastLoginIp; random current IPs | Email sent iff lastLoginIp set AND IPs differ |
| P9: Group-delete sends N emails | Random groups with 1–10 members | `sendEmail` call count === member count |
| P10: Void-expense sends N emails | Random expenses with 1–10 splits | `sendEmail` call count === splits length |
| P11: Cron sets expiringSoonEmailSentAt | Random qualifying InviteToken sets | All processed tokens have non-null `expiringSoonEmailSentAt` after cron run |
| P12: Monetary amounts human-readable | Random integer cent amounts + currency codes | Rendered template contains formatted string, not raw cents |
| P13: Action button has plain-text fallback | Random URLs for button templates | Rendered HTML contains URL as plain text in addition to button |

### Integration Tests

The following are verified with 1–3 representative examples (not property tests) because they test infrastructure wiring or external service behavior:

- Rate limiting is applied to `POST /api/auth/forgot-password` (5 req / 60 s)
- `GET /api/cron/invite-expiring` returns 403 without `CRON_SECRET`
- `passwordResetToken` and `passwordResetExpires` fields are accepted by the User Mongoose schema
- `expiringSoonEmailSentAt` field is accepted by the InviteToken Mongoose schema
- `emailPrefs` field is accepted by the User Mongoose schema
- Resend SDK is called with the correct `from` address when `EMAIL_FROM` is set vs. absent
