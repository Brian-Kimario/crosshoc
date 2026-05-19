# SplitEasy — Email System Audit

## 1. Email Provider

- **Package installed**: `resend` v6.12.2 (confirmed in package.json)
- **Provider used**: Resend API (resend.com)
- **Main utility file**: `lib/email.ts`
- **Send function name**: `sendEmail()`
- **Function signature**:
```typescript
export async function sendEmail(params: SendEmailParams): Promise<void>

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  userId?: string;      // Optional: for emailPrefs check
  prefsKey?: EmailPrefsKey;  // Optional: emailPrefs key to check before sending
}
```
- **Where it lives**: `lib/email.ts`
- **Email template package**: `@react-email/components` v1.0.12

## 2. Environment Variables

List every email-related env var name referenced in code:

- **RESEND_API_KEY**: Present in .env.local but set to `re_placeholder` (PLACEHOLDER VALUE — NOT A REAL API KEY)
- **EMAIL_FROM**: Present in .env.local, set to `SplitEasy <noreply@spliteasy.app>`
- **SUPPORT_EMAIL**: Present in .env.local, set to `support@spliteasy.app`
- **NEXT_PUBLIC_APP_URL**: Present in .env.local, set to `http://localhost:3000`
- **CRON_SECRET**: Present in .env.local, set to `your_cron_secret_here` (PLACEHOLDER VALUE)

## 3. Email Templates

All email templates exist as React components in the `emails/` directory:

- **WelcomeEmail.tsx**: User registration welcome email
- **ForgotPasswordEmail.tsx**: Password reset request email
- **PasswordChangedEmail.tsx**: Password successfully changed confirmation
- **VerifyEmailChangeEmail.tsx**: Email address change verification
- **EmailChangedEmail.tsx**: Email address changed notification (sent to old address)
- **NewLoginEmail.tsx**: New login from different IP detected
- **AccountLockedEmail.tsx**: Account locked due to failed login attempts
- **AccountDeletedEmail.tsx**: Account deleted by admin
- **AccountDisabledEmail.tsx**: Account disabled by admin
- **AccountReEnabledEmail.tsx**: Account re-enabled by admin
- **AdminTriggeredResetEmail.tsx**: Password reset initiated by admin
- **GroupInviteEmail.tsx**: Group invitation email
- **InviteExpiringSoonEmail.tsx**: Invite link expiring soon reminder
- **GroupDeletedEmail.tsx**: Group deleted by admin
- **RemovedFromGroupEmail.tsx**: Member removed from group by admin
- **ExpenseVoidedEmail.tsx**: Expense voided by admin
- **SettlementVoidedEmail.tsx**: Settlement voided by admin
- **EmailLayout.tsx** (component): Shared layout wrapper for all emails

All templates are properly structured React components using `@react-email/components`.

## 4. Trigger Points

Every place in the codebase where an email is supposed to send:

### 4.1 User Registration (Welcome Email)
- **File**: `app/api/auth/register/route.ts`
- **Line**: 38-44
- **Code**:
```typescript
void sendEmail({
  to: email,
  subject: 'Welcome to SplitEasy!',
  react: WelcomeEmail({
    name: newUser.name,
    dashboardUrl: (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') + '/',
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder` (placeholder value triggers no-op in sendEmail function)

### 4.2 Forgot Password (Password Reset Email)
- **File**: `app/api/auth/forgot-password/route.ts`
- **Line**: 68-75
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: 'Reset your SplitEasy password',
  react: ForgotPasswordEmail({
    name: user.name,
    resetUrl,
    expiresInMinutes: 60,
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.3 Password Reset Success (Password Changed Email)
- **File**: `app/api/auth/reset-password/route.ts`
- **Line**: 72-80
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: 'Your SplitEasy password has been changed',
  react: PasswordChangedEmail({
    name: user.name,
    settingsUrl: `${appUrl}/settings`,
    supportEmail,
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.4 Account Locked (Failed Login Attempts)
- **File**: `app/api/auth/login/route.ts`
- **Line**: 68-77
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: 'Your SplitEasy account has been temporarily locked',
  react: AccountLockedEmail({
    name: user.name,
    lockDurationMinutes: 15,
    forgotPasswordUrl: appUrl + '/forgot-password',
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.5 New Login Detected (Different IP)
- **File**: `app/api/auth/login/route.ts`
- **Line**: 100-111
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: 'New login detected on your SplitEasy account',
  react: NewLoginEmail({
    name: user.name,
    loginAt: new Date().toUTCString(),
    ipAddress: currentIp,
    settingsUrl: appUrl + '/settings',
    supportEmail: process.env.SUPPORT_EMAIL ?? 'support@spliteasy.app',
  }),
  userId: user._id.toString(),
  prefsKey: 'newLogin',
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.6 Email Change Verification
- **File**: `app/api/user/change-email/route.ts`
- **Line**: 135-143
- **Code**:
```typescript
void sendEmail({
  to: newEmail,
  subject: "Verify your new SplitEasy email address",
  react: VerifyEmailChangeEmail({
    name: user.name,
    verifyUrl,
    newEmail,
    expiresInHours: 24,
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.7 Admin Changed User Email (Notification to Old Email)
- **File**: `app/api/admin/users/[userId]/profile/route.ts`
- **Line**: 95-103
- **Code**:
```typescript
void sendEmail({
  to: before.email,
  subject: "Your SplitEasy email address has been changed",
  react: EmailChangedEmail({
    name: user.name,
    oldEmail: before.email,
    newEmail: email as string,
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.8 Admin Deleted User Account
- **File**: `app/api/admin/users/[userId]/route.ts`
- **Line**: 99-106
- **Code**:
```typescript
void sendEmail({
  to: capturedEmail,
  subject: "Your SplitEasy account has been deleted",
  react: AccountDeletedEmail({
    name: capturedName,
    reason: body.reason,
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.9 Admin Disabled User Account
- **File**: `app/api/admin/users/[userId]/disable/route.ts`
- **Line**: 42-49
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: "Your SplitEasy account has been disabled",
  react: AccountDisabledEmail({
    name: user.name,
    reason: body.reason,
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.10 Admin Re-enabled User Account
- **File**: `app/api/admin/users/[userId]/enable/route.ts`
- **Line**: 37-43
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: "Your SplitEasy account has been re-enabled",
  react: AccountReEnabledEmail({
    name: user.name,
    dashboardUrl,
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.11 Admin Triggered Password Reset
- **File**: `app/api/admin/users/[userId]/reset-password/route.ts`
- **Line**: 48-56
- **Code**:
```typescript
void sendEmail({
  to: user.email,
  subject: "Password reset initiated by an administrator",
  react: AdminTriggeredResetEmail({
    name: user.name,
    resetUrl,
    expiresInMinutes: 60,
  }),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.12 Group Invitation Email
- **File**: `app/api/groups/[id]/invite/share/route.ts`
- **Line**: 102-113
- **Code**:
```typescript
void sendEmail({
  to: recipientEmail,
  subject: `${user.name} invited you to join ${group.name} on SplitEasy`,
  react: React.createElement(GroupInviteEmail, {
    recipientName: typeof recipientName === "string" ? recipientName : undefined,
    inviterName: user.name,
    groupName: group.name,
    inviteUrl,
    expiresAt: expiresAt.toISOString(),
  }),
  prefsKey: "groupInvite",
  userId: String(userId),
});
```
- **Status**: IMPLEMENTED — fire-and-forget call present
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.13 Invite Link Expiring Soon (Cron Job)
- **File**: `app/api/cron/invite-expiring/route.ts`
- **Line**: 76-86
- **Code**:
```typescript
sendEmail({
  to: creator.email,
  subject: `Your invite link for "${group.name}" is expiring soon`,
  react: React.createElement(InviteExpiringSoonEmail, {
    name: creator.name,
    groupName: group.name,
    hoursRemaining,
    groupUrl,
  }),
  prefsKey: "inviteExpiringSoon",
  userId: String(creator._id),
});
```
- **Status**: IMPLEMENTED — NOT fire-and-forget (no `void` keyword, but also not awaited)
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.14 Admin Deleted Group
- **File**: `app/api/admin/groups/[groupId]/route.ts`
- **Line**: 227-238
- **Code**:
```typescript
sendEmail({
  to: member.email,
  subject: `Your group "${groupName}" has been deleted`,
  react: GroupDeletedEmail({
    name: member.name,
    groupName,
    reason: reason.trim(),
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
  }),
  userId,
  prefsKey: "groupDeleted",
}).catch((err) =>
  logError("[admin delete group] sendEmail", err, { groupId, userId })
);
```
- **Status**: IMPLEMENTED — fire-and-forget with error handler
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.15 Admin Removed Member from Group
- **File**: `app/api/admin/groups/[groupId]/members/[userId]/route.ts`
- **Line**: 106-118
- **Code**:
```typescript
sendEmail({
  to: memberEmail,
  subject: `You have been removed from "${group.name}"`,
  react: React.createElement(RemovedFromGroupEmail, {
    name: memberName,
    groupName: group.name,
    reason: reason.trim() ?? "No reason provided",
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
  }),
  userId: userId,
  prefsKey: "removedFromGroup",
}).catch((err) =>
  logError("[admin remove member] sendEmail", err, { groupId, userId })
);
```
- **Status**: IMPLEMENTED — fire-and-forget with error handler
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.16 Admin Voided Expense
- **File**: `app/api/admin/expenses/[expenseId]/void/route.ts`
- **Line**: (file truncated in read, but code visible in grep results)
- **Code**: Sends `ExpenseVoidedEmail` to each user in expense splits
- **Status**: IMPLEMENTED — fire-and-forget with error handler
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.17 Admin Voided Settlement
- **File**: `app/api/admin/settlements/[settlementId]/void/route.ts`
- **Line**: (file truncated in read, but code visible in grep results)
- **Code**: Sends `SettlementVoidedEmail` to both fromUser and toUser
- **Status**: IMPLEMENTED — fire-and-forget with error handler
- **Issue**: Will not send because `RESEND_API_KEY=re_placeholder`

### 4.18 Budget Alert (Cron Job)
- **File**: `app/api/cron/budget-alerts/route.ts`
- **Line**: N/A
- **Code**: N/A
- **Status**: NOT IMPLEMENTED — only sends in-app notifications via `notify()`, no email sent
- **Issue**: Budget alerts do not trigger any email. Only push notifications are sent.

## 5. Root Cause Analysis

Summary of WHY emails are not being received:

### Primary issues found:

1. **RESEND_API_KEY is set to placeholder value** — The `.env.local` file has `RESEND_API_KEY=re_placeholder`, which is explicitly checked in `lib/email.ts` as a no-op condition. When the API key is `re_placeholder`, the `sendEmail()` function logs a message and returns early without making any API call to Resend.

2. **No real Resend API key configured** — The developer needs to:
   - Sign up at resend.com
   - Create an API key
   - Replace `re_placeholder` with the real API key in `.env.local`

3. **CRON_SECRET is also a placeholder** — The cron jobs that send emails (invite expiring, budget alerts) are protected by `CRON_SECRET`, which is set to `your_cron_secret_here`. This means:
   - The cron jobs will reject requests unless the correct secret is provided
   - Even if emails were configured, cron-triggered emails wouldn't work in production without a real secret

4. **Budget alerts do not send emails at all** — The budget alert cron job (`app/api/cron/budget-alerts/route.ts`) only calls `notify()` for in-app notifications. There is no email template or `sendEmail()` call for budget alerts, even though a `BudgetAlertEmail` template would be expected based on the feature.

### Missing pieces:

- **No BudgetAlertEmail template** — Budget alerts only send in-app notifications, not emails. A `BudgetAlertEmail.tsx` template needs to be created and integrated into the cron job.

- **Real Resend API key** — Must be obtained from resend.com and configured in environment variables.

- **Real CRON_SECRET** — Must be generated and configured for production cron jobs.

- **Domain verification in Resend** — Even with a real API key, the sender domain (`spliteasy.app`) must be verified in the Resend dashboard, or emails must be sent from a verified Resend domain.

## 6. What IS working (if anything)

- **Email utility function is correctly implemented** — `lib/email.ts` has proper error handling, never throws, and includes emailPrefs opt-out logic.
- **All email templates are properly structured** — 16 email templates exist as React components using `@react-email/components`.
- **All trigger points are implemented** — Every email scenario has a `sendEmail()` call in the appropriate route.
- **Fire-and-forget pattern is correctly used** — Most calls use `void sendEmail(...)` or `.catch()` to prevent email failures from crashing operations.
- **Security-critical emails bypass opt-out** — Emails without `userId`/`prefsKey` (like password resets, account deletions) are always sent regardless of user preferences.
- **No-op guard prevents crashes in development** — The placeholder check ensures the app doesn't crash when Resend is not configured.

**However**: Nothing in the email pipeline is currently functional because the API key is a placeholder.

## 7. Files that need to be created or fixed

| File | Action needed | Why |
|------|--------------|-----|
| `.env.local` | FIX | Replace `RESEND_API_KEY=re_placeholder` with real API key from resend.com |
| `.env.local` | FIX | Replace `CRON_SECRET=your_cron_secret_here` with a real secret (e.g., generated via `openssl rand -hex 32`) |
| `emails/BudgetAlertEmail.tsx` | CREATE | Budget alert email template is missing — only in-app notifications are sent |
| `app/api/cron/budget-alerts/route.ts` | FIX | Add `sendEmail()` call to send budget alert emails in addition to in-app notifications |
| Resend Dashboard | CONFIGURE | Verify sender domain `spliteasy.app` in Resend dashboard, or use Resend's verified domain for testing |
| Production Environment Variables | CONFIGURE | Set `RESEND_API_KEY`, `CRON_SECRET`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `NEXT_PUBLIC_APP_URL` in Vercel/production environment |

## 8. Recommended email provider

Based on the current setup, the app is already configured for Resend:

### Option A: Resend (resend.com) — RECOMMENDED
**Pros:**
- Already integrated in the codebase
- Excellent React email support (works seamlessly with `@react-email/components`)
- Simple API, minimal configuration
- Free tier: 100 emails/day, 3,000 emails/month
- Good deliverability
- Modern developer experience
- No SMTP configuration needed

**Cons:**
- Requires domain verification for production use
- Free tier is limited (but sufficient for small-to-medium apps)

### Option B: SendGrid
**Pros:**
- Free tier: 100 emails/day forever
- Established provider with good deliverability
- More generous free tier for long-term use

**Cons:**
- Requires code changes (replace Resend SDK with SendGrid SDK)
- More complex API
- Requires SMTP or API key configuration
- Less modern developer experience

### Option C: Nodemailer + Gmail SMTP
**Pros:**
- Free for low-volume use
- No third-party service signup required

**Cons:**
- Gmail has strict sending limits (500 emails/day)
- Requires app-specific password setup
- Less reliable deliverability
- Not suitable for production
- Requires code changes

### Recommendation: **Stick with Resend**

The app is already fully integrated with Resend. The only missing piece is a real API key. Resend's free tier (3,000 emails/month) is sufficient for most small-to-medium apps, and the developer experience is excellent. The migration cost to another provider would be high with no significant benefit.

**Action items:**
1. Sign up at resend.com
2. Create an API key
3. Verify the sender domain (`spliteasy.app`) or use Resend's test domain for development
4. Update `.env.local` with the real API key

## 9. Environment variables that need to be added

The following variables are already defined in `.env.local` but need real values:

```bash
# Replace placeholder with real API key from resend.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Generate a secure random secret for cron job authentication
# Example: openssl rand -hex 32
CRON_SECRET=your_generated_secret_here_64_characters_long

# These are already correctly set, but verify for production:
EMAIL_FROM=SplitEasy <noreply@spliteasy.app>
SUPPORT_EMAIL=support@spliteasy.app
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to production URL in production
```

**For production (Vercel environment variables):**
- Set all of the above in the Vercel dashboard under Project Settings → Environment Variables
- Ensure `NEXT_PUBLIC_APP_URL` points to the production domain (e.g., `https://spliteasy.app`)
- Ensure `CRON_SECRET` matches the secret used in Vercel Cron configuration

## 10. Complete list of emails the app should send

Based on reading the full codebase, these are ALL the emails that should exist (whether currently implemented or not):

1. **Welcome Email** — When user registers — Recipient: new user — **Currently: EXISTS**
2. **Forgot Password Email** — When user requests password reset — Recipient: user — **Currently: EXISTS**
3. **Password Changed Email** — When password is successfully reset — Recipient: user — **Currently: EXISTS**
4. **Account Locked Email** — When account is locked due to failed login attempts — Recipient: user — **Currently: EXISTS**
5. **New Login Email** — When login from new IP is detected — Recipient: user — **Currently: EXISTS**
6. **Email Change Verification** — When user requests email change — Recipient: new email address — **Currently: EXISTS**
7. **Email Changed Notification** — When email is changed (sent to old address) — Recipient: old email address — **Currently: EXISTS**
8. **Admin Deleted Account** — When admin deletes user account — Recipient: deleted user — **Currently: EXISTS**
9. **Admin Disabled Account** — When admin disables user account — Recipient: disabled user — **Currently: EXISTS**
10. **Admin Re-enabled Account** — When admin re-enables user account — Recipient: re-enabled user — **Currently: EXISTS**
11. **Admin Triggered Password Reset** — When admin initiates password reset — Recipient: user — **Currently: EXISTS**
12. **Group Invitation** — When user is invited to join a group — Recipient: invitee — **Currently: EXISTS**
13. **Invite Link Expiring Soon** — When group invite link is about to expire — Recipient: invite creator — **Currently: EXISTS**
14. **Group Deleted by Admin** — When admin deletes a group — Recipient: all group members — **Currently: EXISTS**
15. **Removed from Group by Admin** — When admin removes member from group — Recipient: removed member — **Currently: EXISTS**
16. **Expense Voided by Admin** — When admin voids an expense — Recipient: all users in expense splits — **Currently: EXISTS**
17. **Settlement Voided by Admin** — When admin voids a settlement — Recipient: both parties (fromUser and toUser) — **Currently: EXISTS**
18. **Budget Alert Email** — When group spending reaches alert threshold — Recipient: all group members — **Currently: MISSING**

---

## Summary

The email system is **fully implemented** in code but **completely non-functional** because:

1. `RESEND_API_KEY` is set to a placeholder value (`re_placeholder`)
2. No real Resend API key has been configured
3. Budget alert emails are not implemented (only in-app notifications exist)

**To fix:**
1. Sign up at resend.com and get a real API key
2. Replace `RESEND_API_KEY=re_placeholder` in `.env.local`
3. Verify sender domain in Resend dashboard
4. Create `BudgetAlertEmail.tsx` template
5. Add email sending to budget alerts cron job
6. Generate and set a real `CRON_SECRET`
7. Configure all environment variables in production (Vercel)

Once the API key is configured, all 17 existing email triggers will start working immediately.
