# Requirements Document

## Introduction

This document defines the security hardening requirements for SplitEasy — a financial web application built on Next.js 14 App Router, MongoDB/Mongoose, custom JWT auth (jose library), and deployed on Vercel. The hardening is a purely defensive infrastructure layer covering 12 areas: rate limiting, input validation, brute-force protection, security headers, MongoDB injection sanitization, file upload security, sensitive data auditing, auth token hardening, environment variable validation, API route auth auditing, and structured error logging. No business logic, frontend components, or monetary calculation code is changed.

All monetary values in the system are stored as integer cents. Auth uses HTTP-only cookies with jose-signed JWTs.

---

## Glossary

- **API_Layer**: The collection of Next.js App Router route handlers under `app/api/`.
- **Auth_Middleware**: The Next.js middleware (`middleware.ts`) and `verifyAuth()` helper in `lib/auth.ts` that validate JWT cookies on incoming requests.
- **Rate_Limiter**: The module at `lib/rate-limit.ts` that enforces per-IP request quotas using Upstash Redis with an in-memory Map fallback.
- **Validator**: The Zod-based schema validation module at `lib/validations.ts`.
- **Sanitizer**: The module at `lib/sanitize.ts` that strips MongoDB operator keys and escapes regex special characters.
- **Login_Route**: The API route handler at `app/api/auth/login/route.ts`.
- **Register_Route**: The API route handler at `app/api/auth/register/route.ts`.
- **Upload_Route**: The API route handler at `app/api/upload/receipt/route.ts`.
- **User_Model**: The Mongoose model defined in `lib/models/User.ts`.
- **Env_Checker**: The module at `lib/env-check.ts` that validates required environment variables at startup.
- **Logger**: The structured error logging module at `lib/logger.ts`.
- **Mutation_Route**: Any API route handler that handles POST, PUT, PATCH, or DELETE HTTP methods.
- **SAFE_USER_FIELDS**: A constant in `lib/sanitize.ts` that defines the MongoDB field projection excluding `password`, `loginAttempts`, `lockUntil`, and `lastLoginIp`.
- **tokenVersion**: An integer field on the User_Model that is incremented to invalidate all existing JWT sessions for that user.
- **Magic_Bytes**: The first bytes of a file's binary content that identify its true format, independent of the declared MIME type or filename extension.

---

## Requirements

### Requirement 1: Rate Limiting Infrastructure

**User Story:** As a system operator, I want all sensitive API endpoints to enforce per-IP request rate limits, so that automated abuse, credential stuffing, and denial-of-service attacks are mitigated.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL use Upstash Redis with a sliding window algorithm as its primary rate-limiting backend.
2. IF the Upstash Redis connection is unavailable, THEN THE Rate_Limiter SHALL fall back to an in-memory Map to enforce rate limits for the current process instance.
3. THE Rate_Limiter SHALL expose the following named presets:
   - `auth`: 5 requests per 60-second window
   - `mutation`: 30 requests per 60-second window
   - `read`: 100 requests per 60-second window
   - `upload`: 10 requests per 60-second window
   - `invite`: 5 requests per 3600-second (1-hour) window
4. WHEN a request exceeds the applicable rate limit, THE Rate_Limiter SHALL return an HTTP 429 response with a `Retry-After` header indicating the number of seconds until the window resets.
5. THE Rate_Limiter SHALL apply the `auth` preset to: `POST /api/auth/login`, `POST /api/auth/register`.
6. THE Rate_Limiter SHALL apply the `mutation` preset to: `POST /api/groups`, `POST /api/expenses`, `POST /api/groups/[id]/settle`, `POST /api/settlements/[id]/dispute`.
7. THE Rate_Limiter SHALL apply the `invite` preset to: `POST /api/groups/[id]/invite`.
8. THE Rate_Limiter SHALL apply the `upload` preset to: `POST /api/upload/receipt`.
9. THE Rate_Limiter SHALL apply the `auth` preset to: `POST /api/guest/activate`.
10. WHEN a request is within the rate limit, THE Rate_Limiter SHALL add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers to the response.

---

### Requirement 2: Zod Schema Validation

**User Story:** As a system operator, I want all mutation API endpoints to validate request bodies against strict schemas, so that malformed, unexpected, or malicious input is rejected before reaching business logic.

#### Acceptance Criteria

1. THE Validator SHALL define and export Zod schemas for the following operations: `LoginSchema`, `RegisterSchema`, `CreateGroupSchema`, `UpdateGroupSchema`, `CreateExpenseSchema`, `UpdateExpenseSchema`, `CreateSettlementSchema`, `DisputeSettlementSchema`, `JoinGroupSchema`, `GuestActivateSchema`, `UpdateProfileSchema`, `ChangePasswordSchema`.
2. WHEN a Mutation_Route receives a request body, THE API_Layer SHALL parse the body using the applicable Validator schema before executing any business logic.
3. IF a request body fails Validator schema parsing, THEN THE API_Layer SHALL return an HTTP 400 response containing a structured list of field-level validation errors.
4. THE `CreateExpenseSchema` SHALL include a refinement that verifies the sum of all split amounts equals the total expense amount, and SHALL reject inputs where this invariant is violated.
5. THE `CreateSettlementSchema` SHALL include a refinement that verifies `fromUserId` is not equal to `toUserId`, and SHALL reject self-settlement inputs.
6. WHEN a Mutation_Route successfully validates a request body, THE API_Layer SHALL use the typed, validated data object for all subsequent operations rather than the raw request body.
7. THE Validator schemas SHALL reject inputs containing unexpected additional fields (strict mode) to prevent parameter pollution.

---

### Requirement 3: Brute Force Protection on Login

**User Story:** As a system operator, I want the login endpoint to detect and block repeated failed authentication attempts, so that brute-force password attacks are prevented.

#### Acceptance Criteria

1. THE User_Model SHALL include the following fields: `loginAttempts` (Number, default 0), `lockUntil` (Date, optional), `lastLoginAt` (Date, optional), `lastLoginIp` (String, optional).
2. WHEN a login attempt fails due to an incorrect password, THE Login_Route SHALL increment the `loginAttempts` counter for the matching user account.
3. WHEN `loginAttempts` reaches 5 for a user account, THE Login_Route SHALL set `lockUntil` to 15 minutes from the current time.
4. WHILE a user account has a `lockUntil` value in the future, THE Login_Route SHALL return an HTTP 429 response with a message indicating the account is temporarily locked and the number of minutes remaining, without performing a password comparison.
5. WHEN a login attempt is made for an email address that does not exist in the database, THE Login_Route SHALL perform a bcrypt hash comparison against a static dummy hash to ensure the response time is indistinguishable from a failed attempt on a real account.
6. WHEN a login attempt succeeds, THE Login_Route SHALL reset `loginAttempts` to 0, clear `lockUntil`, and record `lastLoginAt` and `lastLoginIp` for the authenticated user.
7. THE Login_Route SHALL NOT reveal in its error response whether the failure was due to an incorrect password or a non-existent email address; both cases SHALL return the same generic error message.

---

### Requirement 4: Security Headers

**User Story:** As a system operator, I want all HTTP responses to include appropriate security headers, so that common browser-based attacks such as clickjacking, MIME sniffing, and cross-site scripting are mitigated.

#### Acceptance Criteria

1. THE API_Layer SHALL include the following headers on all responses: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: off`.
2. THE API_Layer SHALL include a `Permissions-Policy` header that disables camera, microphone, and geolocation access.
3. WHERE the deployment environment is production, THE API_Layer SHALL include an `HSTS` header (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
4. THE API_Layer SHALL include a `Content-Security-Policy` header with directives compatible with Next.js App Router, including: `default-src 'self'`, `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (required for Next.js), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https://res.cloudinary.com`, `connect-src 'self'`, `frame-ancestors 'none'`.
5. THE API_Layer SHALL include `Cache-Control: no-store` on all responses from routes under `/api/`.
6. THE security headers SHALL be applied via `next.config.ts` using the `headers()` configuration function so they are enforced at the framework level.

---

### Requirement 5: MongoDB Injection Sanitization

**User Story:** As a system operator, I want all user-supplied input used in MongoDB queries to be sanitized, so that MongoDB operator injection attacks are prevented.

#### Acceptance Criteria

1. THE Sanitizer SHALL export a `sanitizeMongoInput` function that recursively traverses an input object and removes any key that starts with `$` or contains `.`.
2. THE Sanitizer SHALL export a `sanitizeRegex` function that escapes all regex special characters (`\ ^ $ . | ? * + ( ) [ ] { }`) in a string so it can be safely used in a `new RegExp()` constructor.
3. WHEN a search query is received by any admin route that constructs a MongoDB `$regex` query, THE API_Layer SHALL pass the query string through `sanitizeRegex` before constructing the regular expression.
4. FOR ALL input objects passed to `sanitizeMongoInput`, the returned object SHALL contain no keys starting with `$` and no keys containing `.`, regardless of nesting depth.
5. FOR ALL strings passed to `sanitizeRegex`, the returned string SHALL produce no regex syntax errors when passed to `new RegExp()`.

---

### Requirement 6: File Upload Security

**User Story:** As a system operator, I want the receipt upload endpoint to validate file type, size, and content, so that malicious file uploads are rejected.

#### Acceptance Criteria

1. THE Upload_Route SHALL maintain an allowlist of permitted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`.
2. WHEN a file upload request is received, THE Upload_Route SHALL reject any file whose declared `Content-Type` is not in the MIME type allowlist, returning HTTP 415.
3. WHEN a file upload request is received, THE Upload_Route SHALL read the first 8 bytes of the file content and validate them against the expected Magic_Bytes for the declared MIME type; IF the Magic_Bytes do not match, THEN THE Upload_Route SHALL return HTTP 415.
4. WHEN a file upload request is received, THE Upload_Route SHALL reject any file whose size exceeds 10,485,760 bytes (10 MiB), returning HTTP 413.
5. WHEN a file upload request is received, THE Upload_Route SHALL sanitize the filename by removing path traversal sequences (`../`, `./`), stripping non-alphanumeric characters except `.`, `-`, and `_`, and truncating to 255 characters.
6. FOR ALL file types in the allowlist, the Magic_Bytes validation SHALL use the following signatures:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: bytes 0–3 `52 49 46 46` and bytes 8–11 `57 45 42 50`
   - GIF: `47 49 46 38`
   - PDF: `25 50 44 46`

---

### Requirement 7: Sensitive Data Audit

**User Story:** As a system operator, I want all API responses that return user data to exclude sensitive fields, so that passwords, security metadata, and IP addresses are never exposed to clients.

#### Acceptance Criteria

1. THE Sanitizer SHALL export a `SAFE_USER_FIELDS` constant that defines a MongoDB field projection string or object that explicitly excludes: `password`, `loginAttempts`, `lockUntil`, `lastLoginIp`.
2. THE API_Layer SHALL use `SAFE_USER_FIELDS` in all `User.find()`, `User.findById()`, `User.findOne()`, and `User.findByIdAndUpdate()` calls that return user data to the client.
3. THE API_Layer SHALL NOT include raw error messages from caught exceptions in HTTP responses returned to clients; all catch blocks in `app/api/` SHALL return a generic, non-revealing error message.
4. FOR ALL API responses containing user objects, the response body SHALL NOT contain the fields `password`, `loginAttempts`, `lockUntil`, or `lastLoginIp`.

---

### Requirement 8: Auth Token Security

**User Story:** As a system operator, I want JWT sessions to be invalidatable server-side, so that compromised tokens, password changes, and admin-forced logouts are effective immediately.

#### Acceptance Criteria

1. THE User_Model SHALL include a `tokenVersion` field (Number, default 0, required).
2. WHEN THE Login_Route issues a JWT, THE Auth_Middleware SHALL include the user's current `tokenVersion` value in the JWT payload.
3. WHEN THE Auth_Middleware validates a JWT on an incoming request, THE Auth_Middleware SHALL query the database to compare the `tokenVersion` in the JWT payload against the current `tokenVersion` stored in the User_Model.
4. IF the `tokenVersion` in the JWT payload does not match the current value in the User_Model, THEN THE Auth_Middleware SHALL reject the request with HTTP 401.
5. WHEN a user changes their password, THE API_Layer SHALL increment the user's `tokenVersion` by 1 in the User_Model.
6. WHEN an admin disables a user account, THE API_Layer SHALL increment the user's `tokenVersion` by 1 in the User_Model.
7. WHEN a user triggers a "logout all devices" action, THE API_Layer SHALL increment the user's `tokenVersion` by 1 in the User_Model.
8. THE `authToken` cookie SHALL be set with `httpOnly: true`, `secure: true` in production, and `sameSite: lax`.

---

### Requirement 9: Environment Variable Validation

**User Story:** As a developer, I want the application to validate required environment variables at startup, so that misconfigured deployments fail fast with a clear error rather than producing silent runtime failures.

#### Acceptance Criteria

1. THE Env_Checker SHALL export a `validateEnv()` function that checks for the presence and non-empty value of the following variables: `MONGODB_URI` (or `DB_CONNECTION_STRING`), `JWT_SECRET`, `NEXTAUTH_URL`.
2. WHEN `validateEnv()` is called and a required variable is missing or empty, THE Env_Checker SHALL throw an `Error` with a message listing all missing variable names if the `NODE_ENV` is `development` or `test`.
3. WHEN `validateEnv()` is called and a required variable is missing or empty, THE Env_Checker SHALL log an error message listing all missing variable names to `console.error` if the `NODE_ENV` is `production`.
4. THE `dbConnect()` function in `lib/db.ts` SHALL call `validateEnv()` before attempting a database connection.
5. THE Env_Checker SHALL also validate the presence of `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, logging a warning (not throwing) if they are absent, since the Rate_Limiter has an in-memory fallback.

---

### Requirement 10: API Route Auth Audit

**User Story:** As a system operator, I want every mutation API route to verify authentication before executing any logic, so that unauthenticated requests cannot modify application data.

#### Acceptance Criteria

1. THE API_Layer SHALL ensure that every Mutation_Route calls `verifyAuth(request)` as the first operation after `dbConnect()`, before any database reads or writes.
2. IF `verifyAuth(request)` returns null on a Mutation_Route, THEN THE API_Layer SHALL return `unauthorizedResponse()` (HTTP 401) immediately, without executing any further logic.
3. THE API_Layer SHALL apply this auth check to all routes handling POST, PUT, PATCH, or DELETE methods under `app/api/`, with the exception of: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/guest/activate`, and `GET /api/groups/join/[token]`.
4. FOR ALL Mutation_Routes (excluding the public exceptions in criterion 3), an unauthenticated request SHALL receive HTTP 401 before any database operation is performed.

---

### Requirement 11: Structured Error Logging

**User Story:** As a developer, I want all API route errors to be captured through a centralized logging function, so that errors are consistently formatted, traceable, and optionally forwarded to an external monitoring service.

#### Acceptance Criteria

1. THE Logger SHALL export a `logError(context: string, error: unknown, metadata?: Record<string, unknown>): void` function.
2. THE `logError` function SHALL log a structured object containing: the `context` string (e.g., `"[login route]"`), a sanitized error message (using `error instanceof Error ? error.message : String(error)`), the current UTC timestamp, and any provided `metadata`.
3. THE API_Layer SHALL replace all `console.error(...)` calls in catch blocks under `app/api/` with `logError(...)` calls, passing the route context as the first argument.
4. WHERE the `SENTRY_DSN` environment variable is defined, THE Logger SHALL forward the error to Sentry using the Sentry SDK; WHERE it is not defined, THE Logger SHALL write to `console.error` only.
5. THE `logError` function SHALL NOT throw; IF the logging operation itself fails, THE Logger SHALL silently suppress the secondary error to avoid masking the original error.

---

### Requirement 12: Package and Environment Setup

**User Story:** As a developer, I want the required security packages installed and environment variables documented, so that the security hardening infrastructure has all its dependencies available.

#### Acceptance Criteria

1. THE project SHALL have `zod` added as a production dependency.
2. THE project SHALL have `@upstash/ratelimit` and `@upstash/redis` added as production dependencies.
3. THE `.env.local` file SHALL document (with placeholder values) the following variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`.
4. WHEN the application starts without `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` defined, THE Rate_Limiter SHALL operate in in-memory fallback mode without throwing an error.
