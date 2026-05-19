# Requirements Document

## Introduction

The SplitEasy email system is fully implemented with 17 email triggers and templates, but completely non-functional due to placeholder configuration values. This feature unblocks the existing email infrastructure by replacing placeholder values with real credentials, adds the missing budget alert email functionality, and ensures production readiness. The scope is strictly limited to configuration changes and the single missing email template—no modifications to existing email triggers, templates, or business logic.

## Glossary

- **Email_System**: The Resend-based email infrastructure in lib/email.ts that sends transactional emails
- **Resend**: Third-party email service provider (resend.com) used for sending emails
- **RESEND_API_KEY**: Environment variable containing the Resend API authentication key
- **CRON_SECRET**: Environment variable used to authenticate cron job requests
- **EMAIL_FROM**: Environment variable specifying the sender email address
- **Budget_Alert_Cron**: Scheduled job at app/api/cron/budget-alerts/route.ts that checks spending thresholds
- **BudgetAlertEmail**: Missing React email template for budget alert notifications
- **No-op_Guard**: Code in lib/email.ts that prevents email sending when RESEND_API_KEY equals "re_placeholder"
- **Fire-and-forget**: Pattern where email sending does not block or crash the calling operation
- **Test_Endpoint**: Temporary API route for verifying email delivery functionality

## Requirements

### Requirement 1: Replace Placeholder API Key

**User Story:** As a developer, I want to replace the placeholder RESEND_API_KEY with a real Resend API key, so that the email system can send emails.

#### Acceptance Criteria

1. THE Email_System SHALL reject API keys that exactly match the string "re_placeholder"
2. WHEN RESEND_API_KEY is set to "re_placeholder", THE Email_System SHALL log a no-op message and return without sending
3. WHEN RESEND_API_KEY is set to a valid Resend API key format, THE Email_System SHALL attempt to send emails via the Resend API
4. THE No-op_Guard SHALL only block the exact string "re_placeholder" and not block other placeholder-like values

### Requirement 2: Configure Cron Authentication Secret

**User Story:** As a system administrator, I want to replace the placeholder CRON_SECRET with a real secret, so that cron jobs can authenticate properly in production.

#### Acceptance Criteria

1. WHEN CRON_SECRET is set to "your_cron_secret_here", THE Budget_Alert_Cron SHALL reject unauthenticated requests
2. THE CRON_SECRET SHALL be a cryptographically secure random string of at least 32 characters
3. WHEN a cron request includes a valid CRON_SECRET, THE Budget_Alert_Cron SHALL process the request

### Requirement 3: Configure Email Sender Address

**User Story:** As a developer, I want to configure EMAIL_FROM to use a verified domain, so that emails are delivered successfully.

#### Acceptance Criteria

1. WHEN EMAIL_FROM is not set, THE Email_System SHALL use "onboarding@resend.dev" as the default sender
2. WHEN EMAIL_FROM is set to a verified domain address, THE Email_System SHALL use that address as the sender
3. THE Email_System SHALL include a fallback to Resend's verified test domain if the configured domain is not verified

### Requirement 4: Create Budget Alert Email Template

**User Story:** As a group member, I want to receive email notifications when my group approaches or exceeds its budget, so that I can take action to control spending.

#### Acceptance Criteria

1. THE BudgetAlertEmail SHALL render a React email component using @react-email/components
2. WHEN a budget alert is triggered, THE BudgetAlertEmail SHALL display the group name, current spending, budget limit, and percentage used
3. WHEN spending is approaching the budget threshold, THE BudgetAlertEmail SHALL display an "approaching budget" message
4. WHEN spending exceeds the budget, THE BudgetAlertEmail SHALL display an "over budget" message
5. THE BudgetAlertEmail SHALL include a link to the group page
6. THE BudgetAlertEmail SHALL use the shared EmailLayout component for consistent styling

### Requirement 5: Send Budget Alert Emails

**User Story:** As a group member, I want to receive budget alert emails in addition to in-app notifications, so that I am notified even when not using the app.

#### Acceptance Criteria

1. WHEN the Budget_Alert_Cron detects a budget threshold violation, THE Budget_Alert_Cron SHALL send a BudgetAlertEmail to all group members
2. WHEN sending budget alert emails, THE Budget_Alert_Cron SHALL use the fire-and-forget pattern to prevent email failures from crashing the cron job
3. WHEN a budget alert email fails to send, THE Budget_Alert_Cron SHALL log the error and continue processing other alerts
4. THE Budget_Alert_Cron SHALL send budget alert emails without checking user email preferences (financial notifications bypass opt-out)
5. THE Budget_Alert_Cron SHALL send both in-app notifications and emails for each budget alert

### Requirement 6: Create Test Endpoint for Email Verification

**User Story:** As a developer, I want to test email delivery through a dedicated endpoint, so that I can verify the email system works before deploying to production.

#### Acceptance Criteria

1. THE Test_Endpoint SHALL send a test email to a specified recipient address
2. WHEN the test email is sent successfully, THE Test_Endpoint SHALL return a success response with the email ID
3. WHEN the test email fails to send, THE Test_Endpoint SHALL return an error response with the failure reason
4. THE Test_Endpoint SHALL be located at app/api/test-email/route.ts
5. THE Test_Endpoint SHALL accept a recipient email address as a query parameter or request body

### Requirement 7: Verify Existing Email Triggers

**User Story:** As a developer, I want to verify that all 17 existing email triggers work correctly, so that I can confirm the email system is fully functional.

#### Acceptance Criteria

1. WHEN a user registers, THE Email_System SHALL send a WelcomeEmail
2. WHEN a user requests password reset, THE Email_System SHALL send a ForgotPasswordEmail
3. WHEN a password is reset successfully, THE Email_System SHALL send a PasswordChangedEmail
4. WHEN an account is locked, THE Email_System SHALL send an AccountLockedEmail
5. WHEN a new login is detected, THE Email_System SHALL send a NewLoginEmail
6. WHEN an email change is requested, THE Email_System SHALL send a VerifyEmailChangeEmail
7. WHEN an admin changes a user's email, THE Email_System SHALL send an EmailChangedEmail to the old address
8. WHEN an admin deletes an account, THE Email_System SHALL send an AccountDeletedEmail
9. WHEN an admin disables an account, THE Email_System SHALL send an AccountDisabledEmail
10. WHEN an admin re-enables an account, THE Email_System SHALL send an AccountReEnabledEmail
11. WHEN an admin triggers a password reset, THE Email_System SHALL send an AdminTriggeredResetEmail
12. WHEN a user is invited to a group, THE Email_System SHALL send a GroupInviteEmail
13. WHEN an invite link is expiring soon, THE Email_System SHALL send an InviteExpiringSoonEmail
14. WHEN an admin deletes a group, THE Email_System SHALL send a GroupDeletedEmail to all members
15. WHEN an admin removes a member from a group, THE Email_System SHALL send a RemovedFromGroupEmail
16. WHEN an admin voids an expense, THE Email_System SHALL send an ExpenseVoidedEmail to all affected users
17. WHEN an admin voids a settlement, THE Email_System SHALL send a SettlementVoidedEmail to both parties

### Requirement 8: Document Production Environment Variables

**User Story:** As a DevOps engineer, I want clear documentation of all required environment variables, so that I can configure the production environment correctly.

#### Acceptance Criteria

1. THE documentation SHALL list all email-related environment variables: RESEND_API_KEY, CRON_SECRET, EMAIL_FROM, SUPPORT_EMAIL, NEXT_PUBLIC_APP_URL
2. THE documentation SHALL specify the format and requirements for each environment variable
3. THE documentation SHALL include instructions for obtaining a Resend API key
4. THE documentation SHALL include instructions for generating a secure CRON_SECRET
5. THE documentation SHALL specify domain verification requirements for EMAIL_FROM

### Requirement 9: Ensure Error Handling Throughout

**User Story:** As a system administrator, I want email failures to never crash application operations, so that the app remains stable even when the email service is unavailable.

#### Acceptance Criteria

1. WHEN an email fails to send, THE Email_System SHALL log the error and continue execution
2. WHEN an email fails to send, THE Email_System SHALL NOT throw an exception to the calling code
3. WHEN the Budget_Alert_Cron encounters an email error, THE Budget_Alert_Cron SHALL continue processing remaining alerts
4. THE Email_System SHALL use the fire-and-forget pattern for all email sending operations
5. WHEN the Resend API returns an error, THE Email_System SHALL catch the error and log it without propagating

### Requirement 10: Preserve Existing Email System Behavior

**User Story:** As a developer, I want to ensure that no existing email triggers or templates are modified, so that the current implementation remains stable.

#### Acceptance Criteria

1. THE Email_System SHALL NOT modify any of the 17 existing email trigger points in API routes
2. THE Email_System SHALL NOT modify any of the 16 existing email templates
3. THE Email_System SHALL NOT modify the sendEmail() function signature or core logic
4. THE Email_System SHALL NOT modify user email preference checking behavior
5. THE Email_System SHALL NOT modify the fire-and-forget pattern used by existing triggers
