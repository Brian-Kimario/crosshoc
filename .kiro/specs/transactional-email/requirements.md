# Requirements Document

## Introduction

This feature adds a comprehensive transactional email system to SplitEasy using Resend as the delivery provider and React Email for template authoring. The system covers five categories of events: account lifecycle, admin actions on user data, security alerts, group events, and irreversible financial admin actions.

The guiding principle is a clean division of responsibility between the existing in-app notification system and email: in-app notifications (`lib/notify.ts`) cover events that users see when they are logged in and active; email covers events that matter when the user is offline, locked out, or when the action is irreversible and warrants a durable record outside the app.

The central utility is `lib/email.ts`, which exports a `sendEmail()` function that follows the same fire-and-forget pattern as `notify()` — it never throws and never crashes the calling operation. Email templates live in `emails/` as React Email `.tsx` components. The forgot-password flow requires new `passwordResetToken` and `passwordResetExpires` fields on the User model and a new `/forgot-password` and `/reset-password` page pair.

---

## Glossary

- **Email_Service**: The module at `lib/email.ts` that wraps the Resend SDK and exposes `sendEmail()`.
- **Resend**: The third-party transactional email API used as the delivery provider.
- **React_Email**: The `@react-email/components` library used to author HTML email templates as React components.
- **Template**: A React Email `.tsx` component in the `emails/` directory that renders a single email type.
- **Password_Reset_Token**: A cryptographically random, URL-safe token stored (hashed) on the User document, used to authenticate a password-reset request.
- **Password_Reset_Flow**: The end-to-end sequence: user requests reset → Email_Service sends token link → user clicks link → user sets new password → token is invalidated.
- **Admin_Panel**: The Next.js pages under `/admin` and API routes under `/api/admin`.
- **User_Model**: The Mongoose model defined in `lib/models/User.ts`.
- **Notify**: The existing in-app notification utility at `lib/notify.ts`.
- **Rate_Limiter**: The existing rate-limiting module at `lib/rate-limit.ts` backed by Upstash Redis.
- **tokenVersion**: The integer field on the User_Model incremented to invalidate all existing JWT sessions.
- **Appeal_Email**: The support contact address (configurable via `SUPPORT_EMAIL` env var) included in account-action emails so users can contest admin decisions.

---

## Requirements

### Requirement 1: Email Service Infrastructure

**User Story:** As a developer, I want a central `sendEmail()` utility that wraps Resend, so that every email-sending call site is consistent, never crashes the main operation, and is easy to test.

#### Acceptance Criteria

1. THE Email_Service SHALL export a `sendEmail(params: SendEmailParams): Promise<void>` function where `SendEmailParams` includes `to: string`, `subject: string`, and `react: React.ReactElement`.
2. WHEN `sendEmail()` is called and the Resend API call succeeds, THE Email_Service SHALL resolve without throwing.
3. IF the Resend API call fails for any reason (network error, invalid API key, rate limit), THEN THE Email_Service SHALL catch the error, log it via `console.error`, and resolve without throwing, so that the calling operation is never interrupted.
4. WHEN the `RESEND_API_KEY` environment variable is absent or empty, THE Email_Service SHALL log a warning and return without attempting a network call.
5. THE Email_Service SHALL read the sender address from the `EMAIL_FROM` environment variable, falling back to `"SplitEasy <noreply@spliteasy.app>"` if the variable is absent.
6. THE Email_Service SHALL be importable as a server-only module and SHALL NOT be bundled into client-side code.
7. THE project SHALL add `resend` and `@react-email/components` as production dependencies.
8. THE `.env.local` file SHALL document (with placeholder values) the following variables: `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`, `NEXT_PUBLIC_APP_URL`.

---

### Requirement 2: Forgot Password Flow

**User Story:** As a user, I want to request a password reset link by email when I have forgotten my password, so that I can regain access to my account without contacting support.

#### Acceptance Criteria

1. THE User_Model SHALL include two new optional fields: `passwordResetToken` (String, hashed SHA-256, nullable) and `passwordResetExpires` (Date, nullable).
2. WHEN a user submits a valid email address to `POST /api/auth/forgot-password`, THE API_Layer SHALL look up the user by email, generate a cryptographically random 32-byte token, store its SHA-256 hash in `passwordResetToken`, set `passwordResetExpires` to 1 hour from now, and call `sendEmail()` with the Password_Reset_Token link.
3. WHEN `POST /api/auth/forgot-password` is called with an email address that does not exist in the database, THE API_Layer SHALL return HTTP 200 with the same generic success message as a found address, to avoid leaking account existence.
4. THE Rate_Limiter SHALL apply the `auth` preset (5 requests per 60-second window) to `POST /api/auth/forgot-password`.
5. WHEN a user submits a valid token and new password to `POST /api/auth/reset-password`, THE API_Layer SHALL verify the token by hashing the submitted value and comparing it to `passwordResetToken`, verify that `passwordResetExpires` is in the future, hash the new password, update the User document, clear `passwordResetToken` and `passwordResetExpires`, and increment `tokenVersion` to invalidate existing sessions.
6. IF the submitted token does not match or `passwordResetExpires` is in the past, THEN THE API_Layer SHALL return HTTP 400 with a generic invalid-or-expired message and SHALL NOT modify the user's password.
7. THE application SHALL include a `/forgot-password` page with an email input form that calls `POST /api/auth/forgot-password`.
8. THE application SHALL include a `/reset-password` page that reads the token from the URL query parameter, presents a new-password form, and calls `POST /api/auth/reset-password`.
9. THE Password_Reset_Token link sent by email SHALL expire after 1 hour and SHALL be single-use (cleared on successful use).
10. THE Email_Service SHALL send the `ForgotPasswordEmail` template to the user's registered email address containing the reset link and a clear expiry notice.

---

### Requirement 3: Account Lifecycle Emails

**User Story:** As a user, I want to receive email notifications for significant changes to my account, so that I am aware of actions taken on my behalf or by an admin and can take corrective action if needed.

#### Acceptance Criteria

1. WHEN a new user successfully registers, THE Email_Service SHALL send the `WelcomeEmail` template to the new user's email address containing their name and a link to the dashboard.
2. WHEN an admin updates a user's email address via the admin profile-update endpoint, THE Email_Service SHALL send the `EmailChangedEmail` template to the **old** email address, informing the user of the change and providing the Appeal_Email address.
3. WHEN a user successfully changes their own password via the settings page, THE Email_Service SHALL send the `PasswordChangedEmail` template to the user's email address as a security confirmation.
4. WHEN a password reset is completed via the Password_Reset_Flow, THE Email_Service SHALL send the `PasswordChangedEmail` template to the user's email address.
5. WHEN an admin disables a user account, THE Email_Service SHALL send the `AccountDisabledEmail` template to the user's email address containing the reason (if provided) and the Appeal_Email address.
6. WHEN an admin re-enables a previously disabled user account, THE Email_Service SHALL send the `AccountReEnabledEmail` template to the user's email address.
7. WHEN an admin permanently deletes a user account, THE Email_Service SHALL send the `AccountDeletedEmail` template to the user's email address containing the reason (if provided) and the Appeal_Email address.
8. WHEN an admin triggers a password reset for a user via the admin panel, THE Email_Service SHALL send the `AdminTriggeredResetEmail` template to the user's email address, informing them that an admin initiated the reset and including the reset link.

---

### Requirement 4: Security Alert Emails

**User Story:** As a user, I want to receive email alerts for suspicious account activity, so that I can take immediate action if my account is being accessed without my knowledge.

#### Acceptance Criteria

1. WHEN a user successfully logs in from an IP address that differs from `lastLoginIp` stored on the User document, THE Email_Service SHALL send the `NewLoginEmail` template to the user's email address containing the login timestamp (UTC), approximate location derived from the IP (country/region if available, otherwise the raw IP), and a link to the account settings page.
2. WHEN a user's account is locked due to reaching the maximum failed login attempts (as defined in the brute-force protection requirement), THE Email_Service SHALL send the `AccountLockedEmail` template to the user's email address containing the lock duration and a link to the forgot-password page.
3. THE `NewLoginEmail` SHALL be sent only when `lastLoginIp` is already set on the user document (i.e., not on the very first login), to avoid alerting on initial account creation.
4. IF the `lastLoginIp` matches the current login IP, THE Email_Service SHALL NOT send a `NewLoginEmail`.

---

### Requirement 5: Group Event Emails

**User Story:** As a user, I want to receive email notifications for group events that affect me when I may be offline or have been removed from the group, so that I am informed of changes I cannot see in the app.

#### Acceptance Criteria

1. WHEN an admin removes a user from a group, THE Email_Service SHALL send the `RemovedFromGroupEmail` template to the removed user's email address containing the group name, the reason provided by the admin, and the Appeal_Email address.
2. WHEN an admin deletes a group, THE Email_Service SHALL send the `GroupDeletedEmail` template to every user who was a member of the group at the time of deletion, containing the group name, the reason provided by the admin, and the Appeal_Email address.
3. WHEN a group invite link is created or regenerated, THE Email_Service SHALL NOT send an automatic email; invite emails are sent only when a user explicitly shares the invite link via the in-app share dialog.
4. WHERE a user explicitly triggers the "send invite by email" action in the share dialog, THE Email_Service SHALL send the `GroupInviteEmail` template to the specified recipient email address containing the inviter's name, the group name, the invite link, and the expiry time.
5. WHEN an invite token's `expiresAt` is within 6 hours of the current time and the invite has not yet been used, THE Email_Service SHALL send the `InviteExpiringSoonEmail` template to the group creator's email address containing the group name and the remaining time.
6. THE invite-expiring notification (criterion 5) SHALL be triggered by a scheduled job (cron route) and SHALL NOT be sent more than once per invite token.

---

### Requirement 6: Financial Admin Action Emails

**User Story:** As a user, I want to receive email notifications when an admin voids an expense or settlement that involves me, so that I have a durable record of the irreversible action outside the app.

#### Acceptance Criteria

1. WHEN an admin voids an expense, THE Email_Service SHALL send the `ExpenseVoidedEmail` template to every user listed in the expense's `splits` array, containing the expense description, original amount, group name, the admin's reason, and the Appeal_Email address.
2. WHEN an admin voids a settlement, THE Email_Service SHALL send the `SettlementVoidedEmail` template to both the `fromUser` and the `toUser` of the settlement, containing the settlement amount, group name, the admin's reason, and the Appeal_Email address.
3. THE `ExpenseVoidedEmail` and `SettlementVoidedEmail` SHALL clearly label the action as irreversible and direct users to the Appeal_Email address if they believe the action was taken in error.

---

### Requirement 7: Email Templates

**User Story:** As a developer, I want all email templates to be React Email components with a consistent visual style, so that emails are maintainable, on-brand, and render correctly across major email clients.

#### Acceptance Criteria

1. THE project SHALL include the following Template files in the `emails/` directory, each as a `.tsx` React Email component:
   - `WelcomeEmail`
   - `ForgotPasswordEmail`
   - `PasswordChangedEmail`
   - `EmailChangedEmail`
   - `AccountDisabledEmail`
   - `AccountReEnabledEmail`
   - `AccountDeletedEmail`
   - `AdminTriggeredResetEmail`
   - `NewLoginEmail`
   - `AccountLockedEmail`
   - `RemovedFromGroupEmail`
   - `GroupDeletedEmail`
   - `GroupInviteEmail`
   - `InviteExpiringSoonEmail`
   - `ExpenseVoidedEmail`
   - `SettlementVoidedEmail`
2. EACH Template SHALL use `@react-email/components` primitives (`Html`, `Head`, `Body`, `Container`, `Text`, `Button`, `Link`, `Hr`, `Preview`) and SHALL NOT use raw HTML strings.
3. EACH Template SHALL include a `<Preview>` element with a concise one-line summary of the email content, used as the inbox preview text.
4. EACH Template SHALL accept a typed `props` interface and SHALL NOT use `any` types.
5. THE Templates SHALL share a common layout wrapper component (`emails/components/EmailLayout.tsx`) that provides consistent header branding, footer with the app name, and an unsubscribe/support link.
6. EACH Template that references a monetary amount SHALL display the amount in the group's currency using a human-readable format (e.g., "$12.50" not "1250 cents").
7. EACH Template that includes an action button (e.g., reset password, view group) SHALL render the button URL as a plain-text fallback link below the button for email clients that block images or buttons.

---

### Requirement 8: Invite-Expiring Cron Job

**User Story:** As a group creator, I want to be notified when my group's invite link is about to expire, so that I can regenerate it before it becomes unusable.

#### Acceptance Criteria

1. THE application SHALL expose a `GET /api/cron/invite-expiring` route that queries all InviteToken documents where `expiresAt` is between now and 6 hours from now, `usedAt` is null (for single-use tokens), and a `expiringSoonEmailSentAt` field is not set.
2. WHEN the cron route finds qualifying invite tokens, THE Email_Service SHALL send the `InviteExpiringSoonEmail` to the group creator's email address for each qualifying token.
3. AFTER sending the email, THE cron route SHALL set `expiringSoonEmailSentAt` to the current timestamp on the InviteToken document to prevent duplicate sends.
4. THE cron route SHALL be protected by a `CRON_SECRET` bearer token check (consistent with the existing `CRON_SECRET` env var documented in the security-hardening spec).
5. THE InviteToken model SHALL be extended with an optional `expiringSoonEmailSentAt` field (Date, nullable) to support idempotent cron execution.

---

### Requirement 9: Notification Preferences for Email

**User Story:** As a user, I want to control which transactional emails I receive, so that I am not overwhelmed by notifications for events I do not care about.

#### Acceptance Criteria

1. THE User_Model SHALL be extended with an `emailPrefs` field (object, optional) containing boolean toggles for the following email types: `newLogin`, `groupInvite`, `inviteExpiringSoon`, `expenseVoided`, `settlementVoided`, `removedFromGroup`, `groupDeleted`.
2. WHEN `sendEmail()` is called for an email type that has a corresponding `emailPrefs` toggle, THE Email_Service SHALL check the recipient user's `emailPrefs` before sending; IF the toggle is explicitly `false`, THE Email_Service SHALL skip sending without error.
3. THE following email types SHALL always be sent regardless of `emailPrefs`, because they are security-critical or account-critical: `ForgotPasswordEmail`, `PasswordChangedEmail`, `EmailChangedEmail`, `AccountDisabledEmail`, `AccountReEnabledEmail`, `AccountDeletedEmail`, `AdminTriggeredResetEmail`, `AccountLockedEmail`.
4. THE settings page SHALL expose UI controls for the opt-out email preferences listed in criterion 1.

---

### Requirement 10: Environment and Deployment

**User Story:** As a developer, I want the email system to be safely no-op when not configured, so that local development and CI environments work without a live Resend account.

#### Acceptance Criteria

1. WHEN `RESEND_API_KEY` is absent or set to the placeholder value `"re_placeholder"`, THE Email_Service SHALL log each attempted send to `console.log` with the recipient, subject, and template name, and SHALL NOT make any network call to Resend.
2. THE application SHALL start and operate normally (including all non-email features) when `RESEND_API_KEY` is not configured.
3. THE `.env.local` file SHALL document `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`, and `NEXT_PUBLIC_APP_URL` with placeholder values and inline comments explaining each variable.
4. THE `NEXT_PUBLIC_APP_URL` variable SHALL be used by all Templates to construct absolute URLs (dashboard links, reset links, invite links) so that links work correctly in both staging and production environments.
