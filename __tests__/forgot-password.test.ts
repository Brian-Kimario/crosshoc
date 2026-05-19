/**
 * Unit tests for POST /api/auth/forgot-password route.
 *
 * Validates: Requirements 2.2, 2.3, 2.4
 *
 * Tests:
 * 1. Returns 200 for non-existent email (anti-enumeration)
 * 2. Stores SHA-256 hash of token, not raw token
 * 3. Sets passwordResetExpires approximately 1 hour from now
 * 4. Returns 429 when rate limit exceeded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSave, mockUserFindOne, mockSendEmail, mockCheckRateLimit } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);

  const mockUserFindOne = vi.fn();

  const mockSendEmail = vi.fn().mockResolvedValue(undefined);

  const mockCheckRateLimit = vi.fn();

  return { mockSave, mockUserFindOne, mockSendEmail, mockCheckRateLimit };
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

// Mock rate-limit module
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: vi.fn((result: { reset: number }) => {
    const { NextResponse } = require('next/server');
    const now = Math.floor(Date.now() / 1000);
    const retryAfter = Math.max(1, result.reset - now);
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }),
}));

// Mock sendEmail to prevent actual email sends
vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

// Mock ForgotPasswordEmail template to prevent React Email rendering issues
vi.mock('@/emails/ForgotPasswordEmail', () => ({
  ForgotPasswordEmail: vi.fn(() => null),
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
function makeRequest(body: unknown, ip = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
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

/** Default rate-limit exceeded result */
const rateLimitExceeded = {
  success: false,
  limit: 5,
  remaining: 0,
  reset: Math.floor(Date.now() / 1000) + 60,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit passes
    mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
    // Default: user not found
    mockUserFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // -------------------------------------------------------------------------
  // Requirement 2.3 — Anti-enumeration: always return 200
  // -------------------------------------------------------------------------

  describe('anti-enumeration (Requirement 2.3)', () => {
    it('returns 200 with generic message when email does not exist', async () => {
      // User not found
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const request = makeRequest({ email: 'nonexistent@example.com' });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe(
        'If that email is registered, a reset link has been sent.'
      );
    });

    it('returns 200 with the same generic message when email exists', async () => {
      // User found
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'existing@example.com',
          name: 'Alice',
          passwordResetToken: null,
          passwordResetExpires: null,
          save: mockSave,
        }),
      });

      const request = makeRequest({ email: 'existing@example.com' });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toBe(
        'If that email is registered, a reset link has been sent.'
      );
    });

    it('response body is identical for found and not-found emails', async () => {
      // Not found
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });
      const notFoundResponse = await POST(makeRequest({ email: 'ghost@example.com' }));
      const notFoundBody = await notFoundResponse.json();

      // Found
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'real@example.com',
          name: 'Bob',
          passwordResetToken: null,
          passwordResetExpires: null,
          save: mockSave,
        }),
      });
      const foundResponse = await POST(makeRequest({ email: 'real@example.com' }));
      const foundBody = await foundResponse.json();

      expect(notFoundResponse.status).toBe(foundResponse.status);
      expect(notFoundBody).toEqual(foundBody);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.2 — Token stored as SHA-256 hash, not raw token
  // -------------------------------------------------------------------------

  describe('token hashing (Requirement 2.2)', () => {
    it('stores SHA-256 hash of the token, not the raw token', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      let capturedResetUrl: string | undefined;

      // Capture the resetUrl passed to sendEmail
      mockSendEmail.mockImplementation((params: { react: unknown }) => {
        // The route passes the react element; we need to capture the resetUrl
        // from the ForgotPasswordEmail call args instead
        return Promise.resolve();
      });

      // Capture what ForgotPasswordEmail was called with
      const { ForgotPasswordEmail } = await import('@/emails/ForgotPasswordEmail');
      const mockFPE = vi.mocked(ForgotPasswordEmail);
      mockFPE.mockImplementation((props) => {
        capturedResetUrl = props.resetUrl;
        return null as unknown as ReturnType<typeof ForgotPasswordEmail>;
      });

      let capturedToken: string | undefined;
      const mockUser = {
        email: 'user@example.com',
        name: 'Alice',
        passwordResetToken: null as string | null,
        passwordResetExpires: null as Date | null,
        save: mockSave,
      };

      // Intercept the token assignment via a setter
      Object.defineProperty(mockUser, 'passwordResetToken', {
        get() { return capturedToken ?? null; },
        set(value: string) { capturedToken = value; },
        configurable: true,
      });

      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const request = makeRequest({ email: 'user@example.com' });
      await POST(request);

      // capturedToken is what was stored on the user
      expect(capturedToken).toBeDefined();

      // capturedResetUrl contains the raw token in the query string
      expect(capturedResetUrl).toBeDefined();
      const url = new URL(capturedResetUrl!);
      const rawToken = url.searchParams.get('token');
      expect(rawToken).toBeDefined();
      expect(rawToken).not.toBeNull();

      // The stored token must be the SHA-256 hash of the raw token
      const expectedHash = sha256(rawToken!);
      expect(capturedToken).toBe(expectedHash);

      // The stored token must NOT equal the raw token
      expect(capturedToken).not.toBe(rawToken);
    });

    it('stored token is a 64-character hex string (SHA-256 output)', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      let capturedToken: string | undefined;
      const mockUser = {
        email: 'user@example.com',
        name: 'Alice',
        passwordResetToken: null as string | null,
        passwordResetExpires: null as Date | null,
        save: mockSave,
      };

      Object.defineProperty(mockUser, 'passwordResetToken', {
        get() { return capturedToken ?? null; },
        set(value: string) { capturedToken = value; },
        configurable: true,
      });

      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      await POST(makeRequest({ email: 'user@example.com' }));

      expect(capturedToken).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.2 — passwordResetExpires set to ~1 hour from now
  // -------------------------------------------------------------------------

  describe('token expiry (Requirement 2.2)', () => {
    it('sets passwordResetExpires approximately 1 hour from now', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      const beforeCall = Date.now();

      let capturedExpires: Date | undefined;
      const mockUser = {
        email: 'user@example.com',
        name: 'Alice',
        passwordResetToken: null as string | null,
        passwordResetExpires: null as Date | null,
        save: mockSave,
      };

      Object.defineProperty(mockUser, 'passwordResetExpires', {
        get() { return capturedExpires ?? null; },
        set(value: Date) { capturedExpires = value; },
        configurable: true,
      });

      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      await POST(makeRequest({ email: 'user@example.com' }));

      const afterCall = Date.now();

      expect(capturedExpires).toBeDefined();
      expect(capturedExpires).toBeInstanceOf(Date);

      const expiresMs = capturedExpires!.getTime();
      const oneHourMs = 3600000;

      // Should be approximately 1 hour from now (within a 5-second tolerance)
      expect(expiresMs).toBeGreaterThanOrEqual(beforeCall + oneHourMs - 5000);
      expect(expiresMs).toBeLessThanOrEqual(afterCall + oneHourMs + 5000);
    });

    it('passwordResetExpires is in the future', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

      let capturedExpires: Date | undefined;
      const mockUser = {
        email: 'user@example.com',
        name: 'Alice',
        passwordResetToken: null as string | null,
        passwordResetExpires: null as Date | null,
        save: mockSave,
      };

      Object.defineProperty(mockUser, 'passwordResetExpires', {
        get() { return capturedExpires ?? null; },
        set(value: Date) { capturedExpires = value; },
        configurable: true,
      });

      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      await POST(makeRequest({ email: 'user@example.com' }));

      expect(capturedExpires!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.4 — Rate limiting returns 429
  // -------------------------------------------------------------------------

  describe('rate limiting (Requirement 2.4)', () => {
    it('returns 429 when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(rateLimitExceeded);

      const request = makeRequest({ email: 'user@example.com' });
      const response = await POST(request);

      expect(response.status).toBe(429);
    });

    it('returns error body when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(rateLimitExceeded);

      const request = makeRequest({ email: 'user@example.com' });
      const response = await POST(request);
      const body = await response.json();

      expect(body.error).toBe('Too many requests');
    });

    it('does not look up user when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(rateLimitExceeded);

      const request = makeRequest({ email: 'user@example.com' });
      await POST(request);

      expect(mockUserFindOne).not.toHaveBeenCalled();
    });

    it('does not send email when rate limit is exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(rateLimitExceeded);

      const request = makeRequest({ email: 'user@example.com' });
      await POST(request);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('allows request when rate limit is not exceeded', async () => {
      mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);

      const request = makeRequest({ email: 'nonexistent@example.com' });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Additional — input validation
  // -------------------------------------------------------------------------

  describe('input validation', () => {
    it('returns 400 when email is missing', async () => {
      const request = makeRequest({});
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when email is empty string', async () => {
      const request = makeRequest({ email: '' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when request body is invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
