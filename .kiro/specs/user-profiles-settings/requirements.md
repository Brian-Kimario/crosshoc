# Requirements Document

## Introduction

Phase 10 of SplitEasy adds full user profile management, a complete settings experience, and account lifecycle controls. Currently the settings page is mostly placeholder. After this phase, users can upload avatars (shown throughout the app), change their password and email, manage active sessions, export their data, and delete their account. Default preferences (currency, split method) are wired into the expense creation flow. The feature is built on the existing Next.js 14 App Router stack with MongoDB/Mongoose, custom JWT (jose), Tailwind CSS, Shadcn UI, Framer Motion, Cloudinary, and SWR.

---

## Glossary

- **System**: The SplitEasy web application.
- **User**: An authenticated account holder.
- **Profile**: The set of public-facing user fields: displayName, bio, and avatarUrl.
- **Avatar**: A profile photo stored on Cloudinary, displayed as a 256×256 face-aware crop.
- **UserAvatar**: The React component that renders a user's avatar photo or a colored initials circle when no photo exists.
- **Session**: A record of an authenticated login, identified by a unique sessionId, stored in the User document.
- **JWT**: The JSON Web Token issued on login, containing userId, tokenVersion, and sessionId.
- **Preferences**: User-level defaults for currency and split method stored in the User document.
- **PendingEmail**: A not-yet-verified new email address stored on the User document during an email-change flow.
- **VerificationToken**: A short-lived cryptographic token sent by email to confirm an email change.
- **DataExport**: A JSON file containing all of a user's personal data, generated on demand.
- **PasswordStrength**: A computed score (weak / fair / strong) based on length, character variety, and entropy of a candidate password.
- **Settings Page**: The tabbed `/settings` route containing Profile, Password, Email, Notifications, Sessions, and Danger Zone tabs.
- **Danger Zone**: The settings tab containing irreversible actions: data export and account deletion.
- **TokenVersion**: An integer on the User document incremented on password change to invalidate all existing JWTs.

---

## Requirements

### Requirement 1: User Data Model Extensions

**User Story:** As a developer, I want the User schema to store profile fields, session records, email-change state, and account-deletion state, so that all Phase 10 features have a persistent backing store.

#### Acceptance Criteria

1. THE System SHALL store `avatarUrl`, `bio`, and `displayName` fields on the User document.
2. THE System SHALL store a `preferences` sub-document on the User document containing `currency` (string, default `"USD"`), `splitMethod` (string, default `"equal"`), and `timezone` (string, default `"UTC"`).
3. THE System SHALL store `pendingEmail`, `pendingEmailToken`, and `pendingEmailTokenExpiry` fields on the User document to support the email-change verification flow.
4. THE System SHALL store a `sessions` array on the User document, where each entry contains `sessionId`, `userAgent`, `ipAddress`, `createdAt`, `lastSeenAt`, and `isCurrent`.
5. THE System SHALL limit the `sessions` array to a maximum of 10 entries using a `$slice` operation, removing the oldest entry when the limit is exceeded.
6. THE System SHALL store `deletionRequestedAt`, `dataExportToken`, and `dataExportExpiry` fields on the User document.

---

### Requirement 2: Session-Aware JWT Authentication

**User Story:** As a user, I want each login to create a tracked session, so that I can see and revoke active devices from my settings.

#### Acceptance Criteria

1. WHEN a User logs in, THE System SHALL generate a unique `sessionId` and include it in the JWT payload alongside `userId` and `tokenVersion`.
2. WHEN a User logs in, THE System SHALL store a new session record in the `sessions` array containing `sessionId`, `userAgent`, `ipAddress`, `createdAt`, and `lastSeenAt`.
3. WHEN an authenticated request is received, THE System SHALL update the `lastSeenAt` field of the matching session record in a fire-and-forget manner (non-blocking).
4. WHEN the `sessions` array reaches 10 entries, THE System SHALL remove the oldest session before inserting the new one.
5. IF a JWT contains a `sessionId` that does not exist in the User's `sessions` array, THEN THE System SHALL treat the request as unauthenticated and return a 401 response.

---

### Requirement 3: Profile Read and Update API

**User Story:** As a user, I want to read and update my profile information via API, so that my display name, bio, and preferences are persisted.

#### Acceptance Criteria

1. WHEN an authenticated GET request is made to `/api/user/me`, THE System SHALL return the User's `name`, `email`, `displayName`, `bio`, `avatarUrl`, and `preferences`.
2. WHEN an authenticated PATCH request is made to `/api/user/me` with valid fields, THE System SHALL update `displayName`, `bio`, and/or `preferences` and return the updated profile.
3. IF a PATCH request to `/api/user/me` contains a `displayName` longer than 50 characters, THEN THE System SHALL return a 400 error with a descriptive message.
4. IF a PATCH request to `/api/user/me` contains a `bio` longer than 200 characters, THEN THE System SHALL return a 400 error with a descriptive message.
5. IF a request to `/api/user/me` is made without a valid JWT, THEN THE System SHALL return a 401 response.

---

### Requirement 4: Avatar Upload and Removal

**User Story:** As a user, I want to upload a profile photo and have it appear throughout the app, so that other members can identify me visually.

#### Acceptance Criteria

1. WHEN an authenticated POST request is made to `/api/user/avatar` with an image file, THE System SHALL upload the image to Cloudinary with a face-aware crop at 256×256 pixels and store the resulting URL as `avatarUrl` on the User document.
2. IF the uploaded file exceeds 5 MB, THEN THE System SHALL return a 400 error without uploading to Cloudinary.
3. IF the uploaded file is not JPEG, PNG, or WebP, THEN THE System SHALL return a 400 error without uploading to Cloudinary.
4. WHEN an authenticated DELETE request is made to `/api/user/avatar`, THE System SHALL remove the image from Cloudinary and set `avatarUrl` to null on the User document.
5. IF a request to `/api/user/avatar` is made without a valid JWT, THEN THE System SHALL return a 401 response.

---

### Requirement 5: UserAvatar Component

**User Story:** As a user, I want to see consistent avatar representations throughout the app, so that I can quickly identify group members.

#### Acceptance Criteria

1. THE UserAvatar component SHALL accept `name`, `avatarUrl`, `size`, and `className` props.
2. WHEN `avatarUrl` is provided and non-empty, THE UserAvatar component SHALL render the photo using an `<img>` element with the given URL.
3. WHEN `avatarUrl` is absent or empty, THE UserAvatar component SHALL render a colored circle containing the user's initials.
4. THE UserAvatar component SHALL derive the background color of the initials circle from a deterministic hash of the `name` prop, so that the same name always produces the same color.
5. THE UserAvatar component SHALL support at least three size variants (small, medium, large) that control the pixel dimensions of the rendered element.
6. THE UserAvatar component SHALL replace all existing initials-only avatar circles in the Sidebar, Dashboard group cards, Balance Summary, Who Pays Whom, Members card, Expense cards, Settlement cards, Notification items, and Admin users table.

---

### Requirement 6: Password Change

**User Story:** As a user, I want to change my password after verifying my current one, so that I can maintain account security.

#### Acceptance Criteria

1. WHEN an authenticated POST request is made to `/api/user/change-password` with `currentPassword` and `newPassword`, THE System SHALL verify `currentPassword` against the stored hash before applying any change.
2. IF `currentPassword` does not match the stored hash, THEN THE System SHALL return a 400 error with the message "Current password is incorrect".
3. IF `newPassword` is fewer than 8 characters, THEN THE System SHALL return a 400 error with a descriptive message.
4. WHEN the password change is successful, THE System SHALL hash `newPassword`, store it, increment `tokenVersion`, and delete all session records from the `sessions` array.
5. WHEN the password change is successful, THE System SHALL clear the `authToken` cookie so the user is redirected to login.
6. IF a request to `/api/user/change-password` is made without a valid JWT, THEN THE System SHALL return a 401 response.

---

### Requirement 7: Email Change with Verification

**User Story:** As a user, I want to change my email address with a verification step, so that only I can claim a new email for my account.

#### Acceptance Criteria

1. WHEN an authenticated POST request is made to `/api/user/change-email` with `newEmail` and `password`, THE System SHALL verify `password` against the stored hash before proceeding.
2. IF `password` does not match the stored hash, THEN THE System SHALL return a 400 error with the message "Password is incorrect".
3. IF `newEmail` is already registered to another User account, THEN THE System SHALL return a 400 error with the message "Email is already in use".
4. IF `newEmail` is the same as the User's current email, THEN THE System SHALL return a 400 error with the message "New email must be different from current email".
5. WHEN the email-change request is valid, THE System SHALL store `newEmail` as `pendingEmail`, generate a `pendingEmailToken`, set `pendingEmailTokenExpiry` to 24 hours from now, and send a verification email to `newEmail`.
6. WHEN an authenticated GET request is made to `/api/user/verify-email` with a valid and non-expired `token` query parameter, THE System SHALL apply the pending email change, clear the pending fields, increment `tokenVersion`, and delete all session records.
7. IF the `token` query parameter is missing, expired, or does not match `pendingEmailToken`, THEN THE System SHALL return a 400 error with a descriptive message.
8. WHEN the email verification is successful, THE System SHALL clear the `authToken` cookie so the user is redirected to login.

---

### Requirement 8: Session Management API

**User Story:** As a user, I want to view and revoke my active sessions, so that I can remove access from devices I no longer use.

#### Acceptance Criteria

1. WHEN an authenticated GET request is made to `/api/user/sessions`, THE System SHALL return the list of active sessions, each including `sessionId`, `userAgent`, `ipAddress`, `createdAt`, `lastSeenAt`, and a boolean `isCurrent` flag indicating whether the session matches the JWT's `sessionId`.
2. WHEN an authenticated DELETE request is made to `/api/user/sessions/[sessionId]`, THE System SHALL remove the matching session from the `sessions` array.
3. IF the `sessionId` in the DELETE request matches the current session's `sessionId`, THEN THE System SHALL return a 400 error with the message "Cannot revoke the current session".
4. WHEN an authenticated DELETE request is made to `/api/user/sessions/all`, THE System SHALL remove all sessions from the `sessions` array except the one matching the current JWT's `sessionId`.
5. IF a request to any sessions endpoint is made without a valid JWT, THEN THE System SHALL return a 401 response.

---

### Requirement 9: Data Export

**User Story:** As a user, I want to download all my personal data as a JSON file, so that I have a copy before deleting my account or for my own records.

#### Acceptance Criteria

1. WHEN an authenticated POST request is made to `/api/user/export`, THE System SHALL collect all data associated with the User (profile, preferences, groups, expenses, settlements) and return it as a downloadable JSON file.
2. THE System SHALL set the response `Content-Disposition` header to `attachment; filename="spliteasy-export.json"` for the data export response.
3. IF a request to `/api/user/export` is made without a valid JWT, THEN THE System SHALL return a 401 response.

---

### Requirement 10: Account Deletion

**User Story:** As a user, I want to permanently delete my account after confirming my intent, so that my data is removed from the platform.

#### Acceptance Criteria

1. WHEN an authenticated DELETE request is made to `/api/user/account` with `password` and `confirmText`, THE System SHALL verify `password` against the stored hash before proceeding.
2. IF `password` does not match the stored hash, THEN THE System SHALL return a 400 error with the message "Password is incorrect".
3. IF `confirmText` is not exactly `"DELETE MY ACCOUNT"`, THEN THE System SHALL return a 400 error with the message "Confirmation text does not match".
4. WHEN both `password` and `confirmText` are valid, THE System SHALL delete the User document, clear the `authToken` cookie, and return a 200 response.
5. IF a request to `/api/user/account` is made without a valid JWT, THEN THE System SHALL return a 401 response.

---

### Requirement 11: Settings Page — Tabbed UI

**User Story:** As a user, I want a fully tabbed settings page, so that I can navigate between profile, security, and account management sections without leaving the page.

#### Acceptance Criteria

1. THE Settings Page SHALL render six tabs: Profile, Password, Email, Notifications, Sessions, and Danger Zone.
2. WHEN a tab is selected, THE Settings Page SHALL display only the content for that tab without a full page navigation.
3. THE Settings Page SHALL scroll the tab bar horizontally on viewports narrower than 390px so all tabs remain accessible.
4. THE Settings Page SHALL render all form inputs with a minimum font size of 16px to prevent automatic zoom on iOS Safari.
5. THE Settings Page SHALL render all interactive buttons with a minimum height of 44px to meet touch target guidelines.

---

### Requirement 12: Profile Tab

**User Story:** As a user, I want a Profile tab in settings where I can upload my avatar, set my display name, bio, and default preferences, so that my profile is complete.

#### Acceptance Criteria

1. THE Profile Tab SHALL display the current avatar (or initials circle) with an upload button and a remove button.
2. WHEN the upload button is activated, THE Profile Tab SHALL open a file picker restricted to JPEG, PNG, and WebP files.
3. WHEN a valid image is selected, THE Profile Tab SHALL POST the file to `/api/user/avatar` and update the displayed avatar via SWR mutate on success.
4. WHEN the remove button is activated, THE Profile Tab SHALL send a DELETE to `/api/user/avatar` and revert the displayed avatar to the initials circle via SWR mutate on success.
5. THE Profile Tab SHALL provide inputs for `displayName` and `bio` that submit via PATCH to `/api/user/me`.
6. THE Profile Tab SHALL provide a currency selector and a split method selector that submit via PATCH to `/api/user/me` as part of `preferences`.
7. IF the avatar upload fails, THE Profile Tab SHALL display an inline error message without navigating away.

---

### Requirement 13: Password Tab

**User Story:** As a user, I want a Password tab with a strength indicator, so that I can choose a secure new password.

#### Acceptance Criteria

1. THE Password Tab SHALL provide three fields: current password, new password, and confirm new password.
2. WHILE the new password field contains input, THE Password Tab SHALL display a password strength bar with at least three levels (weak, fair, strong).
3. IF the new password strength is weak, THE Password Tab SHALL disable the submit button.
4. IF the new password and confirm password fields do not match, THE Password Tab SHALL display an inline error and disable the submit button.
5. WHEN the form is submitted successfully, THE Password Tab SHALL redirect the user to the login page.
6. IF the server returns an error (e.g., wrong current password), THE Password Tab SHALL display the error message inline without navigating away.

---

### Requirement 14: Email Tab

**User Story:** As a user, I want an Email tab where I can request an email address change, so that I can keep my account email current.

#### Acceptance Criteria

1. THE Email Tab SHALL display the user's current email address as read-only text.
2. THE Email Tab SHALL provide an input for the new email address and a password confirmation field.
3. WHEN the form is submitted successfully, THE Email Tab SHALL display a confirmation message instructing the user to check their new email inbox.
4. IF the server returns an error (wrong password, email taken, same email), THE Email Tab SHALL display the error message inline without navigating away.

---

### Requirement 15: Sessions Tab

**User Story:** As a user, I want a Sessions tab that lists my active devices, so that I can revoke access from sessions I don't recognize.

#### Acceptance Criteria

1. THE Sessions Tab SHALL fetch and display the list of active sessions from `/api/user/sessions`.
2. THE Sessions Tab SHALL mark the current session with a "This device" badge.
3. WHEN a revoke button is activated for a non-current session, THE Sessions Tab SHALL send a DELETE to `/api/user/sessions/[sessionId]` and remove the session from the list via SWR mutate.
4. THE Sessions Tab SHALL provide a "Sign out all other devices" button that sends a DELETE to `/api/user/sessions/all` and refreshes the session list.
5. THE Sessions Tab SHALL NOT render a revoke button for the current session.

---

### Requirement 16: Danger Zone Tab

**User Story:** As a user, I want a Danger Zone tab with data export and account deletion, so that I can manage the end-of-life of my account safely.

#### Acceptance Criteria

1. THE Danger Zone Tab SHALL provide a "Download my data" button that POSTs to `/api/user/export` and triggers a JSON file download in the browser.
2. THE Danger Zone Tab SHALL provide an account deletion form requiring the user's password and the exact confirmation text `"DELETE MY ACCOUNT"`.
3. IF the password field or confirmation text field is empty, THE Danger Zone Tab SHALL disable the delete button.
4. WHEN the account deletion is confirmed by the server, THE Danger Zone Tab SHALL redirect the user to the home page.
5. IF the server returns an error (wrong password or wrong confirmation text), THE Danger Zone Tab SHALL display the error message inline without navigating away.

---

### Requirement 17: Avatar Propagation Throughout the App

**User Story:** As a user, I want my avatar to appear consistently in every part of the app where my name appears, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE System SHALL include `avatarUrl` in all API responses that return group member lists, expense `paidBy` fields, and settlement `fromUser`/`toUser` fields.
2. THE System SHALL render the UserAvatar component in the Sidebar bottom user card, replacing the existing initials circle.
3. THE System SHALL render the UserAvatar component in Dashboard group cards for the member avatar stack.
4. THE System SHALL render the UserAvatar component in the Balance Summary for each member row.
5. THE System SHALL render the UserAvatar component in the Who Pays Whom section for from/to avatars.
6. THE System SHALL render the UserAvatar component in the Members card on the group detail page.
7. THE System SHALL render the UserAvatar component in Expense cards for the "Paid by" avatar.
8. THE System SHALL render the UserAvatar component in Settlement cards for fromUser and toUser avatars.
9. THE System SHALL render the UserAvatar component in Notification items for the actor avatar.
10. THE System SHALL render the UserAvatar component in the Admin users table.

---

### Requirement 18: Default Preferences in Expense Creation

**User Story:** As a user, I want my preferred currency and split method to be pre-selected when I add an expense, so that I don't have to change them every time.

#### Acceptance Criteria

1. WHEN the Add Expense form is opened, THE System SHALL pre-select the currency using the following priority: group currency → user preference currency → `"USD"`.
2. WHEN the Add Expense form is opened, THE System SHALL pre-select the split method using the following priority: user preference split method → `"equal"`.

---

### Requirement 19: Notifications Tab Wiring

**User Story:** As a user, I want the Notifications tab in settings to show my existing notification preferences, so that all preference management is in one place.

#### Acceptance Criteria

1. THE Notifications Tab SHALL render the existing `NotificationPreferences` component (push notification preferences from Phase 3).
2. THE Notifications Tab SHALL render the existing `EmailNotificationPreferences` component (email notification preferences from Phase 3).
3. THE System SHALL preserve all existing notification preference behavior when the components are moved into the tabbed settings layout.
