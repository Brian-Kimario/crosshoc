/**
 * Property-based tests for POST /api/auth/forgot-password route.
 *
 * Feature: transactional-email, Property 3: Forgot-password token is stored as a hash, not plaintext
 *
 * Validates: Requirements 2.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSave, mockUserFindOne, mockSendEmail, mockCheckRateLimit, mockForgotPasswordEmail } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockUserFindOne = vi.fn();
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockCheckRateLimit = vi.fn();
  const mockForgotPasswordEmail = vi.fn();

  return { mockSave, mockUserFindOne, mockSendEmail, mockCheckRateLimit, mockForgotPasswordEmail };
});

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that trigger them
// ---------------------------------------------------------------------------

// server-only throws in test environments; mock it as a no-op
vi.mock('server-only', () => ({}));

// Mock db connect — no-op
vi.mock('@/lib/db', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

// Mock User model
vi.mock('@/lib/models/User', () => ({
  default: {
    findOne: mockUserFindOne,
  },
}));

// Mock rate-limit module — always passes
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: vi.fn(),
}));

// Mock sendEmail to prevent actual email sends
vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

// Mock ForgotPasswordEmail template to capture resetUrl
vi.mock('@/emails/ForgotPasswordEmail', () => ({
  ForgotPasswordEmail: mockForgotPasswordEmail,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/auth/forgot-password/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest with a JSON body */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  });
}

/** SHA-256 hash helper — mirrors the route implementation */
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Default rate-limit success result */
const rateLimitSuccess = {
  success: true,
  limit: 5,
  remaining: 4,
  reset: Math.floor(Date.now() / 1000) + 60,
};

// ---------------------------------------------------------------------------
// Property 3: Forgot-password token is stored as a hash, not plaintext
// ---------------------------------------------------------------------------

describe('Property 3: Forgot-password token is stored as a hash, not plaintext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit passes
    mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
    // Set app URL for reset link construction
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it(
    'storedToken === sha256(rawToken) and storedToken !== rawToken for any valid email',
    async () => {
      // Feature: transactional-email, Property 3: Forgot-password token is stored as a hash, not plaintext
      // Validates: Requirements 2.2
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          async (email) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);

            // Track what gets stored on the user document
            let capturedStoredToken: string | undefined;
            // Track what URL is passed to ForgotPasswordEmail
            let capturedResetUrl: string | undefined;

            // Intercept ForgotPasswordEmail to capture the resetUrl
            mockForgotPasswordEmail.mockImplementation(
              (props: { name: string; resetUrl: string; expiresInMinutes: number }) => {
                capturedResetUrl = props.resetUrl;
                return null;
              }
            );

            // Build a mock user with a setter to capture the stored token
            const mockUser = {
              email,
              name: 'Test User',
              save: mockSave,
              passwordResetToken: null as string | null,
              passwordResetExpires: null as Date | null,
            };

            Object.defineProperty(mockUser, 'passwordResetToken', {
              get() {
                return capturedStoredToken ?? null;
              },
              set(value: string) {
                capturedStoredToken = value;
              },
              configurable: true,
            });

            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            // Call the route
            const request = makeRequest({ email });
            const response = await POST(request);

            // Route must return 200
            expect(response.status).toBe(200);

            // The stored token must have been set
            expect(capturedStoredToken).toBeDefined();
            expect(typeof capturedStoredToken).toBe('string');

            // The reset URL must have been passed to ForgotPasswordEmail
            expect(capturedResetUrl).toBeDefined();

            // Extract the raw token from the reset URL query parameter
            const url = new URL(capturedResetUrl!);
            const rawToken = url.searchParams.get('token');
            expect(rawToken).not.toBeNull();
            expect(rawToken!.length).toBeGreaterThan(0);

            // Property assertion 1: storedToken === sha256(rawToken)
            const expectedHash = sha256(rawToken!);
            expect(capturedStoredToken).toBe(expectedHash);

            // Property assertion 2: storedToken !== rawToken (not stored as plaintext)
            expect(capturedStoredToken).not.toBe(rawToken);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'stored token is always a 64-character hex string (SHA-256 output format)',
    async () => {
      // Feature: transactional-email, Property 3: Forgot-password token is stored as a hash, not plaintext
      // Validates: Requirements 2.2
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          async (email) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);

            let capturedStoredToken: string | undefined;

            mockForgotPasswordEmail.mockImplementation(
              (props: { resetUrl: string }) => {
                void props.resetUrl; // capture side-effect
                return null;
              }
            );

            const mockUser = {
              email,
              name: 'Test User',
              save: mockSave,
              passwordResetToken: null as string | null,
              passwordResetExpires: null as Date | null,
            };

            Object.defineProperty(mockUser, 'passwordResetToken', {
              get() {
                return capturedStoredToken ?? null;
              },
              set(value: string) {
                capturedStoredToken = value;
              },
              configurable: true,
            });

            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            await POST(makeRequest({ email }));

            // SHA-256 always produces a 64-character lowercase hex string
            expect(capturedStoredToken).toMatch(/^[0-9a-f]{64}$/);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 5: Forgot-password returns HTTP 200 for both found and not-found emails
// ---------------------------------------------------------------------------

describe('Property 5: Forgot-password returns HTTP 200 for both found and not-found emails', () => {
  // Feature: transactional-email, Property 5: Forgot-password returns HTTP 200 for both found and not-found emails
  // Validates: Requirements 2.3

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it(
    'always returns HTTP 200 with identical generic message regardless of whether user exists',
    async () => {
      // Feature: transactional-email, Property 5: Forgot-password returns HTTP 200 for both found and not-found emails
      // Validates: Requirements 2.3
      const EXPECTED_MESSAGE = 'If that email is registered, a reset link has been sent.';

      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.boolean(),
          async (email, userFound) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);

            if (userFound) {
              // Mock User.findOne to return a user with save()
              const mockUser = {
                email,
                name: 'Test User',
                passwordResetToken: null as string | null,
                passwordResetExpires: null as Date | null,
                save: vi.fn().mockResolvedValue(undefined),
              };
              mockUserFindOne.mockReturnValue({
                select: vi.fn().mockResolvedValue(mockUser),
              });
            } else {
              // Mock User.findOne to return null (user not found)
              mockUserFindOne.mockReturnValue({
                select: vi.fn().mockResolvedValue(null),
              });
            }

            const request = makeRequest({ email });
            const response = await POST(request);
            const body = await response.json();

            // Property: always HTTP 200
            expect(response.status).toBe(200);

            // Property: identical response body regardless of user existence
            expect(body).toEqual({ message: EXPECTED_MESSAGE });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
