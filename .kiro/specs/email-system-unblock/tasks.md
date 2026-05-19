# Implementation Plan: Email System Unblock

## Overview

This implementation plan focuses on unblocking the existing email infrastructure by replacing placeholder configuration values, creating the missing BudgetAlertEmail template, and integrating email sending into the budget alerts cron job. The approach is minimal and leverages existing infrastructure without modifying any existing email triggers or templates.

## Tasks

- [x] 1. Create BudgetAlertEmail template component
  - [x] 1.1 Create emails/BudgetAlertEmail.tsx with props interface
    - Define BudgetAlertEmailProps interface with all required fields
    - Export both named and default exports for consistency
    - _Requirements: 4.1, 4.2_
  
  - [x] 1.2 Implement email layout and header section
    - Import and use EmailLayout component for consistent styling
    - Add preview text with group name
    - Create heading with conditional message (approaching vs over budget)
    - _Requirements: 4.3, 4.4, 4.6_
  
  - [x] 1.3 Implement spending summary section
    - Display current spending and budget limit using formatMoney
    - Show percentage used with proper formatting
    - Use appropriate color scheme (amber for approaching, red for over budget)
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 1.4 Implement progress bar component
    - Create visual progress bar with dynamic width based on percentUsed
    - Cap visual width at 100% even if spending exceeds budget
    - Apply conditional colors (amber #F59E0B or red #EF4444)
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 1.5 Add call-to-action button and footer
    - Add "View Group" button linking to groupUrl
    - Include fallback link text for email clients that don't support buttons
    - Match existing email template styling patterns
    - _Requirements: 4.5, 4.6_

- [x] 2. Integrate email sending into budget alerts cron job
  - [x] 2.1 Add imports to app/api/cron/budget-alerts/route.ts
    - Import sendEmail from @/lib/email
    - Import BudgetAlertEmail template
    - Import User model for fetching member details
    - _Requirements: 5.1, 5.2_
  
  - [x] 2.2 Fetch member details after in-app notifications
    - Query User model for member IDs from group.members
    - Select only _id, name, and email fields
    - Use lean() for performance
    - _Requirements: 5.1_
  
  - [x] 2.3 Implement email sending loop with fire-and-forget pattern
    - Wrap email sending in try/catch block
    - Loop through members and call sendEmail with void keyword
    - Pass all required props to BudgetAlertEmail component
    - Calculate isOverBudget flag based on spentPercent
    - Use group.currency with fallback to 'USD'
    - Do NOT pass userId or prefsKey (budget alerts bypass opt-out)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 2.4 Add error handling and logging
    - Catch errors from member fetch or email loop
    - Log errors with group context but continue processing
    - Add logging before and after email sending phase
    - Ensure email failures don't affect alertSentAt update
    - _Requirements: 5.2, 5.3, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3. Checkpoint - Verify code changes compile
  - Run TypeScript compiler to check for type errors
  - Ensure all imports resolve correctly
  - Verify no syntax errors in new code
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create test endpoint for email verification
  - [x] 4.1 Create app/api/test-email/route.ts with development guard
    - Implement GET handler
    - Add NODE_ENV check to disable in production
    - Return 403 Forbidden if accessed in production
    - _Requirements: 6.1, 6.4_
  
  - [x] 4.2 Implement query parameter parsing and validation
    - Parse 'to' and 'template' query parameters
    - Validate 'to' parameter is present and contains '@'
    - Default 'template' to 'welcome' if not provided
    - Return 400 Bad Request for invalid inputs
    - _Requirements: 6.1, 6.5_
  
  - [x] 4.3 Implement template selection logic
    - Add switch statement for template selection
    - Implement 'welcome' template case with test data
    - Implement 'budget-alert' template case with test data
    - Return 400 for unknown template names
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 4.4 Implement email sending and response handling
    - Call sendEmail with selected template
    - Return success response with email details
    - Catch errors and return 500 with error details
    - Include try/catch around sendEmail call
    - _Requirements: 6.2, 6.3_

- [x] 5. Checkpoint - Test email delivery
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update environment configuration documentation
  - [x] 6.1 Document RESEND_API_KEY configuration
    - Document how to obtain API key from resend.com
    - Specify that placeholder value 're_placeholder' triggers no-op
    - Document API key format (starts with 're_')
    - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.3_
  
  - [x] 6.2 Document CRON_SECRET generation and configuration
    - Document how to generate secure secret using openssl
    - Specify minimum length requirement (32 characters)
    - Document how to set in Vercel environment variables
    - _Requirements: 2.1, 2.2, 2.3, 8.1, 8.4_
  
  - [x] 6.3 Document EMAIL_FROM domain verification
    - Document Resend test domain option (onboarding@resend.dev)
    - Document custom domain verification process
    - Document DNS record requirements
    - Specify fallback behavior when domain not verified
    - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.5_
  
  - [x] 6.4 Document all environment variables in README or deployment guide
    - List all required variables: RESEND_API_KEY, CRON_SECRET, EMAIL_FROM, SUPPORT_EMAIL, NEXT_PUBLIC_APP_URL
    - Specify format and requirements for each
    - Document production vs development differences
    - Include example .env.local configuration
    - _Requirements: 8.1, 8.2_

- [x] 7. Final checkpoint - Verify implementation completeness
  - Review all code changes for consistency with design
  - Verify fire-and-forget pattern is preserved throughout
  - Confirm no modifications to existing email triggers or templates
  - Ensure error handling prevents crashes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This feature does NOT modify any existing email triggers or templates (Requirements 10.1-10.5)
- The sendEmail() function signature and core logic remain unchanged (Requirement 10.3)
- Fire-and-forget pattern is preserved throughout (Requirements 9.1-9.5)
- Budget alert emails bypass user email preferences (Requirement 5.4)
- Email failures never crash operations (Requirements 9.1-9.5)
- Test endpoint is development-only and should be removed or disabled in production
- Environment variable configuration (.env.local) is a manual step, not a coding task
- Property-based testing is not applicable for this feature (infrastructure configuration and UI rendering)
- All currency formatting uses the existing formatMoney utility from lib/money-utils.ts
- The design uses TypeScript, so all implementation will be in TypeScript
