# Implementation Plan: Security Hardening

## Overview

This plan hardens SplitEasy's security posture across 12 areas: rate limiting, Zod validation, brute-force protection, security headers, MongoDB injection sanitization, file upload security, sensitive data auditing, auth token hardening, environment variable validation, API route auth auditing, structured error logging, and package setup. Each task builds on the previous — work through them in order.

**Do NOT modify:** frontend components, `lib/money.ts`, `lib/format-utils.ts`, `lib/balance-server.ts`, MongoDB schemas other than `User`, admin panel UI, Tailwind config, `vercel.json`.

---

## Tasks

- [x] 1. Install packages and update environment configuration
  - Run `pnpm add zod @upstash/ratelimit @upstash/redis` to add production dependencies
  - Run `pnpm add -D @types/node` if not already present
  - Add the following placeholder entries to `.env.local` (do not overwrite existing values):
    - `UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url_here`
    - `UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token_here`
    - `CRON_SECRET=your_cron_secret_here`
  - Verify `zod`, `@upstash/ratelimit`, and `@upstash/redis` appear in `package.json` dependencies
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 2. Create `lib/rate-limit.ts` — rate limiting infrastructure
  - Export `RateLimitPreset` type: `'auth' | 'mutation' | 'read' | 'upload' | 'invite'`
  - Export `RateLimitResult` interface: `{ success: boolean; limit: number; remaining: number; reset: number }`
  - Export `checkRateLimit(request: NextRequest, preset: RateLimitPreset): Promise<RateLimitResult>`
  - Primary backend: `@upstash/ratelimit` with `Ratelimit.slidingWindow()` using `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
  - Fallback backend: in-memory `Map<string, { count: number; resetAt: number }>` when Upstash env vars are absent or Redis is unreachable
  - Preset configuration: `auth` 5/60s, `mutation` 30/60s, `read` 100/60s, `upload` 10/60s, `invite` 5/3600s
  - Extract client IP from `x-forwarded-for` (first value) or `x-real-ip`, fallback to `"unknown"`; key format: `${preset}:${ip}`
  - On success: attach `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers to the response
  - On exceeded: return HTTP 429 with `Retry-After` header and body `{ error: "Too many requests", retryAfter: N }`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.10_

- [x] 3. Create `lib/validations.ts` — Zod schema validation
  - Import `z` from `zod` and `NextResponse` from `next/server`
  - Export all 12 schemas using `.strict()` on each to reject extra fields:
    - `LoginSchema`: `email` (`.email()`), `password` (`.min(1)`), optional `guestId` string
    - `RegisterSchema`: `name` (`.min(1).max(100)`), `email` (`.email()`), `password` (`.min(6)`), optional `guestId` string
    - `CreateGroupSchema`: `name` (`.min(1).max(100)`), optional `currency` enum `['USD','INR','TZS']`
    - `UpdateGroupSchema`: optional `name`, optional `currency`
    - `CreateExpenseSchema`: `description`, `totalAmount` (integer cents, positive), `splits` array of `{ userId, amount }` — add `.refine()` that `splits.reduce((s,x) => s + x.amount, 0) === totalAmount`
    - `UpdateExpenseSchema`: same fields as Create but all optional, same split-sum refinement when both present
    - `CreateSettlementSchema`: `fromUserId`, `toUserId`, `amount` (integer cents, positive), optional `method`, `note`, `idempotencyKey` — add `.refine()` that `fromUserId !== toUserId`
    - `DisputeSettlementSchema`: `reason` (`.min(1).max(500)`)
    - `JoinGroupSchema`: `token` (`.min(1)`)
    - `GuestActivateSchema`: `token` (`.min(1)`), `displayName` (`.min(1).max(50)`)
    - `UpdateProfileSchema`: optional `name`, optional `avatar` URL
    - `ChangePasswordSchema`: `currentPassword` (`.min(1)`), `newPassword` (`.min(6)`)
  - Export `parseBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; response: NextResponse }`
    - On failure: return `{ success: false, response: NextResponse.json({ error: 'Validation failed', details: schema.safeParse(data).error?.flatten() }, { status: 400 }) }`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.1 Write property tests for Zod schemas
    - **Property 1: Invalid request bodies produce structured 400 errors** — for any body failing schema parse, `parseBody` returns `success: false` with a response
    - **Property 2: Expense split amounts must sum to total** — for any splits where sum ≠ totalAmount, `CreateExpenseSchema.safeParse()` returns `success: false`
    - **Property 3: Self-settlement is always rejected** — for any userId, `CreateSettlementSchema.safeParse({ fromUserId: id, toUserId: id, ... })` returns `success: false`
    - **Property 4: Strict mode rejects extra fields** — for any valid input with extra keys added, every schema's `.safeParse()` returns `success: false`
    - Use `fast-check` with `fc.assert` / `fc.property`, minimum 100 runs each
    - Tag each test: `// Feature: security-hardening, Property N: <title>`
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.7**

- [x] 4. Create `lib/sanitize.ts` — MongoDB injection sanitization and SAFE_USER_FIELDS
  - Export `SAFE_USER_FIELDS: string` = `"-password -loginAttempts -lockUntil -lastLoginIp"` (space-separated projection string)
  - Export `sanitizeMongoInput<T>(input: T): T` — recursively traverse input; for objects, drop any key starting with `$` or containing `.`; traverse arrays element-by-element; return primitives as-is
  - Export `sanitizeRegex(input: string): string` — escape all regex special characters (`\ ^ $ . | ? * + ( ) [ ] { }`) by prepending a backslash; return the escaped string safe for `new RegExp()`
  - _Requirements: 5.1, 5.2, 7.1_

  - [ ]* 4.1 Write property tests for sanitize functions
    - **Property 5: sanitizeMongoInput removes all operator keys at any depth** — for any arbitrarily nested object, result contains no keys starting with `$` and no keys containing `.`
    - **Property 6: sanitizeRegex produces regex-safe strings** — for any string `s`, `new RegExp(sanitizeRegex(s))` does not throw `SyntaxError`
    - **Property 10: Filename sanitization removes all dangerous characters** — for any filename string, `sanitizeFilename(name)` returns a string with no `../`, `./`, no chars outside `[a-zA-Z0-9._-]`, length ≤ 255 (add `sanitizeFilename` as an additional export in this file)
    - Use `fast-check`, minimum 100 runs each
    - Tag each test: `// Feature: security-hardening, Property N: <title>`
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5, 6.5**

- [x] 5. Create `lib/env-check.ts` — environment variable validation
  - Export `validateEnv(): void`
  - Required variables: `MONGODB_URI` (or `DB_CONNECTION_STRING`), `JWT_SECRET`, `NEXTAUTH_URL`
  - In `development` or `test` (`NODE_ENV`): throw `Error` listing all missing variable names if any are absent or empty
  - In `production`: call `console.error` listing all missing variable names; do not throw
  - Optional variables (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`): log a `console.warn` if absent; never throw
  - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ]* 5.1 Write unit tests for validateEnv
    - Missing required vars in dev → throws with all names listed in the error message
    - Missing required vars in production → calls `console.error`, does not throw
    - Missing Upstash vars → calls `console.warn`, does not throw
    - All vars present → no throw, no warning
    - **Property 18: validateEnv lists all missing variables in the thrown error** — for any non-empty subset of required vars that are absent, thrown error message contains every missing name
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

- [x] 6. Create `lib/logger.ts` — structured error logging
  - Export `logError(context: string, error: unknown, metadata?: Record<string, unknown>): void`
  - Log a structured object: `{ context, message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString(), metadata }`
  - If `SENTRY_DSN` is defined: forward to Sentry via `Sentry.captureException(error, { extra: { context, ...metadata } })`; otherwise write to `console.error`
  - Wrap entire body in try/catch; silently suppress any secondary error to avoid masking the original
  - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [ ]* 6.1 Write unit tests for logError
    - Logs structured object with `context`, `message`, `timestamp` fields
    - Does not throw when logging fails (secondary error suppressed)
    - Calls Sentry when `SENTRY_DSN` is set
    - Falls back to `console.error` when `SENTRY_DSN` is absent
    - **Property 20: logError always produces a structured log with required fields**
    - **Validates: Requirements 11.2, 11.5**

- [x] 7. Update `lib/models/User.ts` — add security fields to User schema
  - Add the following fields to `UserSchema`:
    - `loginAttempts: { type: Number, default: 0 }`
    - `lockUntil: { type: Date, default: null }`
    - `lastLoginAt: { type: Date, default: null }`
    - `lastLoginIp: { type: String, default: null }`
    - `tokenVersion: { type: Number, default: 0, required: true }`
  - Update the `IUser` interface to include all five new fields with correct TypeScript types (`loginAttempts: number`, `lockUntil?: Date | null`, `lastLoginAt?: Date | null`, `lastLoginIp?: string | null`, `tokenVersion: number`)
  - Do NOT modify any other schema fields, indexes, or existing model logic
  - _Requirements: 3.1, 8.1_

- [x] 8. Update `lib/auth.ts` — cookie hardening, tokenVersion in JWT, DB check in verifyAuth
  - Update `signToken(userId: string, tokenVersion: number): string` to embed `{ userId, tokenVersion }` in the JWT payload
  - Update `verifyAuth(request?: NextRequest): Promise<string | null>` to perform a DB lookup after JWT decode: call `User.findById(decoded.userId).select('tokenVersion isDisabled')`; return `null` if user not found, `isDisabled` is true, or `decoded.tokenVersion !== user.tokenVersion`
  - Add `import dbConnect from '@/lib/db'` and call `await dbConnect()` inside `verifyAuth` before the DB query
  - Ensure `authToken` cookie is always set with `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'` — audit all `response.cookies.set('authToken', ...)` calls in `lib/auth.ts` and update any that are missing these flags
  - Update `refreshToken` to accept and forward `tokenVersion` when re-signing
  - _Requirements: 8.2, 8.3, 8.4, 8.8_

- [x] 9. Update `middleware.ts` — extend matcher, add tokenVersion check and rolling session
  - Extend `config.matcher` to include `'/api/auth/:path*'` and `'/api/upload/:path*'` in addition to `'/admin/:path*'`
  - For requests matching `/api/auth/:path*`: call `checkRateLimit(request, 'auth')` and return 429 early if exceeded
  - For requests matching `/api/upload/:path*`: call `checkRateLimit(request, 'upload')` and return 429 early if exceeded
  - For authenticated requests (valid `authToken` cookie): implement rolling session — if `shouldRefreshToken(token)` returns true, re-sign with `refreshToken(token)` and set the new cookie on the response
  - Import `checkRateLimit` from `@/lib/rate-limit` and `shouldRefreshToken`, `refreshToken` from `@/lib/auth`
  - Keep the existing admin redirect logic intact
  - _Requirements: 1.5, 8.8_

- [x] 10. Update `next.config.ts` — add security headers
  - Add an `async headers()` function to the `nextConfig` object
  - Apply to `source: '/(.*)'`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: off`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and the full `Content-Security-Policy` value from the design (`default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; frame-ancestors 'none'`)
  - Apply to `source: '/api/(.*)'`: `Cache-Control: no-store`
  - Conditionally add HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`) only when `process.env.NODE_ENV === 'production'`
  - Do NOT modify the existing `images.remotePatterns` configuration
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 11. Update `lib/db.ts` — call validateEnv before connecting
  - Import `validateEnv` from `@/lib/env-check`
  - Call `validateEnv()` as the first statement inside `dbConnect()`, before the `if (cached) return cached` check
  - Remove the existing top-level `if (!MONGODB_URI) { throw new Error(...) }` guard (it is now superseded by `validateEnv()`)
  - _Requirements: 9.4_

- [x] 12. Checkpoint — build verification after infrastructure layer
  - Run `pnpm build` and confirm zero TypeScript errors
  - Fix any type errors introduced by the new fields on `IUser`, the updated `signToken` signature, or the new imports
  - Ensure all tests pass, ask the user if questions arise

- [x] 13. Update `app/api/auth/login/route.ts` — rate limit, Zod, brute-force lockout, timing-safe
  - Apply `checkRateLimit(request, 'auth')` as the first operation; return 429 if exceeded
  - Replace manual field checks with `parseBody(LoginSchema, await request.json())`; return 400 on failure
  - Add brute-force lockout logic using the new `User` fields:
    - After `dbConnect()`, look up user by email; if `lockUntil` is in the future, return HTTP 429 with minutes remaining — do NOT call `comparePasswords`
    - If user not found: call `comparePasswords(password, DUMMY_HASH)` (define `const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu'`) and return the same generic error as a wrong password
    - On failed password: increment `loginAttempts`; if `loginAttempts >= 5`, set `lockUntil = new Date(Date.now() + 15 * 60 * 1000)`; save; return generic error
    - On success: reset `loginAttempts = 0`, `lockUntil = null`, set `lastLoginAt = new Date()`, `lastLoginIp` from `x-forwarded-for` or `x-real-ip`; save
  - Update `signToken` call to pass `user.tokenVersion`
  - Replace `console.error` in catch block with `logError('[login route]', error)`
  - Return generic error message for both "wrong password" and "user not found" cases (same message, no distinction)
  - _Requirements: 1.5, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.3, 11.3_

  - [ ]* 13.1 Write property tests for login brute-force logic
    - **Property 12: Failed login increments loginAttempts by exactly 1** — for any user with `loginAttempts = N`, a failed login results in `loginAttempts = N + 1`
    - **Property 13: Locked accounts receive HTTP 429 without password comparison** — for any user with `lockUntil` in the future, login returns 429 without calling `bcrypt.compare`
    - **Property 14: Successful login resets all lockout fields** — for any user with `loginAttempts > 0` and/or `lockUntil` set, successful login results in `loginAttempts = 0`, `lockUntil = null`, `lastLoginAt` and `lastLoginIp` set
    - **Validates: Requirements 3.2, 3.4, 3.6**

- [x] 14. Update `app/api/auth/register/route.ts` — rate limit and Zod validation
  - Apply `checkRateLimit(request, 'auth')` as the first operation; return 429 if exceeded
  - Replace manual field checks with `parseBody(RegisterSchema, await request.json())`; return 400 on failure
  - Update `signToken` call to pass `newUser.tokenVersion` (which defaults to 0 on creation)
  - Replace `console.error` in catch block with `logError('[register route]', error)`
  - Return a generic error message in the catch block (not `error.message`)
  - _Requirements: 1.5, 2.2, 2.3, 7.3, 11.3_

- [x] 15. Update `app/api/groups/route.ts` POST — rate limit and Zod validation
  - Apply `checkRateLimit(request, 'mutation')` after `verifyAuth`; return 429 if exceeded
  - Replace manual `body.name` / `body.currency` extraction with `parseBody(CreateGroupSchema, body)`; return 400 on failure
  - Replace or add `logError('[groups POST]', error)` in the catch block; return generic error message
  - _Requirements: 1.6, 2.2, 2.3, 7.3, 11.3_

- [x] 16. Update `app/api/groups/[id]/expenses/route.ts` POST and PUT — rate limit and Zod validation
  - Note: this route file may need to be created if it does not exist at `app/api/groups/[id]/expenses/route.ts`; check `app/api/expenses/` for the existing expenses route and apply changes there if that is where group expense creation lives
  - Apply `checkRateLimit(request, 'mutation')` after `verifyAuth` on POST and PUT handlers; return 429 if exceeded
  - Replace manual body parsing with `parseBody(CreateExpenseSchema, body)` on POST and `parseBody(UpdateExpenseSchema, body)` on PUT; return 400 on failure
  - Replace `console.error` in catch blocks with `logError('[expenses POST]', error)` / `logError('[expenses PUT]', error)`; return generic error messages
  - _Requirements: 1.6, 2.2, 2.3, 7.3, 11.3_

- [x] 17. Update `app/api/groups/[id]/settle/route.ts` POST — rate limit and Zod validation
  - Apply `checkRateLimit(request, 'mutation')` after `verifyAuth`; return 429 if exceeded
  - Replace manual `body` destructuring and field checks with `parseBody(CreateSettlementSchema, body)`; return 400 on failure
  - Replace `console.error` in catch block with `logError('[settle POST]', error)`; return generic error message
  - _Requirements: 1.6, 2.2, 2.3, 7.3, 11.3_

- [x] 18. Update `app/api/groups/[id]/invite/route.ts` POST — strict rate limit
  - Apply `checkRateLimit(request, 'invite')` after `verifyAuth`; return 429 if exceeded
  - Add `logError('[invite POST]', error)` in the catch block
  - _Requirements: 1.7, 11.3_

- [x] 19. Update `app/api/settlements/[id]/dispute/route.ts` PATCH — Zod validation
  - Replace manual `body.reason` extraction with `parseBody(DisputeSettlementSchema, body)`; return 400 on failure
  - Replace `console.error` in catch block with `logError('[settlement dispute]', error)`; return generic error message
  - _Requirements: 2.2, 2.3, 7.3, 11.3_

- [x] 20. Update `app/api/groups/join/[token]/route.ts` POST — rate limit and Zod validation
  - Apply `checkRateLimit(request, 'mutation')` after `verifyAuth`; return 429 if exceeded
  - Parse and validate the token from params using `JoinGroupSchema` if a body is expected, or validate the `token` param directly
  - Add `logError('[join group POST]', error)` in the catch block
  - _Requirements: 1.6, 2.2, 7.3, 11.3_

- [x] 21. Update `app/api/guest/activate/route.ts` POST — rate limit and Zod validation
  - Apply `checkRateLimit(request, 'auth')` as the first operation; return 429 if exceeded
  - Replace manual `token` / `displayName` checks with `parseBody(GuestActivateSchema, await request.json())`; return 400 on failure
  - Add `logError('[guest activate]', error)` in the catch block; return generic error message
  - _Requirements: 1.9, 2.2, 2.3, 7.3, 11.3_

- [x] 22. Create `app/api/upload/receipt/route.ts` — full file security pipeline with rate limit
  - Create the file (the `app/api/upload/` directory exists but is empty)
  - Apply `checkRateLimit(request, 'upload')` as the first operation; return 429 if exceeded
  - Call `verifyAuth(request)`; return 401 if not authenticated
  - Implement the validation pipeline in order:
    1. Parse `multipart/form-data`; extract the file field
    2. MIME type allowlist check against `['image/jpeg','image/png','image/webp','image/gif','application/pdf']`; return HTTP 415 if not in list
    3. Read file as `Buffer`; if `buffer.length > 10_485_760` return HTTP 413
    4. Magic bytes check using the `MAGIC_BYTES` table from the design; return HTTP 415 if mismatch
    5. Filename sanitization: strip `../`, `./`, remove chars outside `[a-zA-Z0-9._-]`, truncate to 255 chars
    6. Upload to Cloudinary (reuse existing Cloudinary config from the project) only after all checks pass
  - Add `logError('[upload receipt]', error)` in the catch block; return generic error message
  - _Requirements: 1.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.1, 11.3_

  - [ ]* 22.1 Write property tests for upload validation
    - **Property 7: Disallowed MIME types are rejected with HTTP 415** — for any MIME type string not in the allowlist, handler returns 415
    - **Property 8: Magic bytes mismatch is rejected with HTTP 415** — for any buffer whose leading bytes do not match the declared MIME type signature, handler returns 415
    - **Property 9: Oversized files are rejected with HTTP 413** — for any buffer length > 10,485,760, handler returns 413
    - Use `fast-check`, minimum 100 runs each
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 23. Checkpoint — build verification after route hardening
  - Run `pnpm build` and confirm zero TypeScript errors
  - Ensure all tests pass, ask the user if questions arise

- [x] 24. Audit all `User.find*()` calls — apply SAFE_USER_FIELDS projection
  - Search all files under `app/api/` for `User.find(`, `User.findById(`, `User.findOne(`, `User.findByIdAndUpdate(` calls that return user data to the client
  - For each call that does NOT already use `.select(SAFE_USER_FIELDS)` or an equivalent explicit exclusion of `password`, `loginAttempts`, `lockUntil`, `lastLoginIp`, add `.select(SAFE_USER_FIELDS)` (import `SAFE_USER_FIELDS` from `@/lib/sanitize`)
  - Exception: calls inside `app/api/auth/login/route.ts` that explicitly need `.select('+password')` for authentication — keep those as-is but ensure the user object returned to the client does not include the password field
  - Exception: calls inside `lib/auth.ts` `verifyAuth` that select only `tokenVersion isDisabled` — leave those as-is
  - _Requirements: 7.2, 7.4_

  - [ ]* 24.1 Write integration test for SAFE_USER_FIELDS coverage
    - **Property 11: API responses never expose sensitive user fields** — for any user document returned by an API route, the serialized response body does not contain `password`, `loginAttempts`, `lockUntil`, or `lastLoginIp`
    - **Validates: Requirements 7.4**

- [x] 25. Audit all catch blocks in `app/api/` — replace raw error messages with logError
  - Search all route files under `app/api/` for `console.error(` calls in catch blocks
  - Replace each with `logError('[<route context>]', error)` where `<route context>` is a descriptive string (e.g., `'[groups GET]'`, `'[settlements confirm]'`)
  - Ensure no catch block returns `error.message` or any raw exception detail in the HTTP response body — all 500 responses must use a generic, non-revealing message
  - Import `logError` from `@/lib/logger` in each modified file
  - _Requirements: 7.3, 11.3_

- [x] 26. Audit all mutation routes for missing auth checks
  - Search all route files under `app/api/` for handlers with POST, PUT, PATCH, or DELETE methods
  - Verify each calls `verifyAuth(request)` as the first operation after `dbConnect()` and returns `unauthorizedResponse()` on null
  - Public exceptions that must NOT have auth: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/guest/activate`, `GET /api/groups/join/[token]`
  - For any mutation route missing the auth check, add it following the pattern in the design document
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 26.1 Write property test for unauthenticated mutation routes
    - **Property 19: Unauthenticated requests to mutation routes receive HTTP 401** — for each mutation route (excluding public exceptions), a request with no valid auth cookie receives HTTP 401 before any DB write
    - **Validates: Requirements 10.1, 10.2, 10.4**

- [x] 27. Apply sanitizeRegex to admin search routes
  - In `app/api/admin/users/route.ts`: import `sanitizeRegex` from `@/lib/sanitize`; wrap the `search` variable with `sanitizeRegex(search)` before it is used in the `$regex` query
  - In `app/api/admin/groups/route.ts`: same — wrap `search` with `sanitizeRegex(search)` before the `$regex` query
  - Check all other admin routes under `app/api/admin/` for any additional `$regex` query constructions and apply `sanitizeRegex` to those as well
  - _Requirements: 5.2, 5.3_

- [x] 28. Final checkpoint — full build and TypeScript verification
  - Run `pnpm build` and confirm zero TypeScript errors and zero build warnings related to the security changes
  - Verify that `lib/rate-limit.ts`, `lib/validations.ts`, `lib/sanitize.ts`, `lib/env-check.ts`, and `lib/logger.ts` all exist and export the expected symbols
  - Verify that `lib/models/User.ts` includes all five new fields in both the schema and the `IUser` interface
  - Verify that `next.config.ts` includes the `headers()` function with all required security headers
  - Ensure all tests pass, ask the user if questions arise

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints (tasks 12, 23, 28) ensure incremental validation — do not skip them
- Property tests use `fast-check`; run with `pnpm test` (or `pnpm vitest --run` for single execution)
- The `signToken` signature change in task 8 will cause TypeScript errors in login and register routes — fix those in tasks 13 and 14 respectively
- The `verifyAuth` DB-check addition in task 8 means every authenticated request now makes one extra lightweight DB query (`_id` lookup, two fields) — this is by design per requirements 8.3–8.4
- Do NOT modify: frontend components, `lib/money.ts`, `lib/format-utils.ts`, `lib/balance-server.ts`, MongoDB schemas other than `User`, admin panel UI, Tailwind config, `vercel.json`
