/**
 * Property-based tests for POST /api/auth/login route.
 *
 * Feature: transactional-email, Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set
 *
 * Validates: Requirements 4.1, 4.3, 4.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSave,
  mockUserFindOne,
  mockSendEmail,
  mockCheckRateLimit,
  mockComparePasswords,
  mockSignToken,
  mockExpenseFind,
  mockNewLoginEmail,
  mockAccountLockedEmail,
} = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockUserFindOne = vi.fn();
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockCheckRateLimit = vi.fn();
  const mockComparePasswords = vi.fn().mockResolvedValue(true);
  const mockSignToken = vi.fn().mockReturnValue('mock-token');
  const mockExpenseFind = vi.fn().mockResolvedValue([]);
  const mockNewLoginEmail = vi.fn().mockReturnValue(null);
  const mockAccountLockedEmail = vi.fn().mockReturnValue(null);

  return {
    mockSave,
    mockUserFindOne,
    mockSendEmail,
    mockCheckRateLimit,
    mockComparePasswords,
    mockSignToken,
    mockExpenseFind,
    mockNewLoginEmail,
    mockAccountLockedEmail,
  };
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
    findByIdAndUpdate: vi.fn().mockResolvedValue(null),
  },
}));

// Mock Expense model
vi.mock('@/lib/models/Expense', () => ({
  default: {
    find: mockExpenseFind,
  },
}));

// Mock auth module
vi.mock('@/lib/auth', () => ({
  comparePasswords: mockComparePasswords,
  signToken: mockSignToken,
  signTokenWithSession: mockSignToken,
  errorResponse: (message: string, status: number) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ success: false, error: message }, { status });
  },
  successResponse: (data: unknown) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ success: true, data }, { status: 200 });
  },
}));

// Mock rate-limit module — always passes
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: vi.fn(),
}));

// Mock validations — parseBody returns success with email/password
vi.mock('@/lib/validations', () => ({
  parseBody: vi.fn((_schema: unknown, data: unknown) => ({
    success: true,
    data: data as { email: string; password: string },
  })),
  LoginSchema: {},
}));

// Mock sendEmail to prevent actual email sends
vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

// Mock NewLoginEmail template
vi.mock('@/emails/NewLoginEmail', () => ({
  NewLoginEmail: mockNewLoginEmail,
}));

// Mock AccountLockedEmail template
vi.mock('@/emails/AccountLockedEmail', () => ({
  AccountLockedEmail: mockAccountLockedEmail,
}));

// Mock logger — no-op
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest with a JSON body and optional x-forwarded-for header */
function makeRequest(body: unknown, currentIp: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': currentIp,
    },
    body: JSON.stringify(body),
  });
}

/** Build a mock user object */
function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'user-id-123' },
    email: 'user@example.com',
    name: 'Test User',
    password: 'hashed_password',
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: null,
    lastLoginIp: null as string | null,
    tokenVersion: 0,
    save: mockSave,
    ...overrides,
  };
}

/** Default rate-limit success result */
const rateLimitSuccess = {
  success: true,
  limit: 5,
  remaining: 4,
  reset: Math.floor(Date.now() / 1000) + 60,
};

// ---------------------------------------------------------------------------
// Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set
// ---------------------------------------------------------------------------

describe('Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
    mockComparePasswords.mockResolvedValue(true);
    mockSignToken.mockReturnValue('mock-token');
    mockExpenseFind.mockResolvedValue([]);
    mockSave.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.JWT_SECRET;
  });

  it(
    'sendEmail is called with prefsKey newLogin iff lastLoginIp is set AND IPs differ',
    async () => {
      // Feature: transactional-email, Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set
      // Validates: Requirements 4.1, 4.3, 4.4
      await fc.assert(
        fc.asyncProperty(
          // lastLoginIp: null means first login (no previous IP stored)
          fc.option(fc.ipV4(), { nil: null }),
          // currentIp: the IP from which the user is logging in now
          fc.ipV4(),
          async (lastLoginIp, currentIp) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
            mockComparePasswords.mockResolvedValue(true);
            mockSignToken.mockReturnValue('mock-token');
            mockExpenseFind.mockResolvedValue([]);
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // Build mock user with the generated lastLoginIp
            const mockUser = makeMockUser({ lastLoginIp });

            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            // Make the login request with the generated currentIp
            const request = makeRequest(
              { email: 'user@example.com', password: 'password123' },
              currentIp
            );
            const response = await POST(request);

            // Login must succeed (HTTP 200)
            expect(response.status).toBe(200);

            // Determine whether NewLoginEmail should have been sent:
            // sendEmail with prefsKey 'newLogin' is called iff:
            //   - lastLoginIp is set (not null/undefined) AND
            //   - currentIp differs from lastLoginIp
            const shouldSendNewLoginEmail =
              lastLoginIp !== null &&
              lastLoginIp !== undefined &&
              lastLoginIp !== currentIp;

            // Find all sendEmail calls with prefsKey 'newLogin'
            const newLoginEmailCalls = mockSendEmail.mock.calls.filter(
              (call) => call[0]?.prefsKey === 'newLogin'
            );

            if (shouldSendNewLoginEmail) {
              // Property: NewLoginEmail MUST be sent when IP changed from a known IP
              expect(newLoginEmailCalls.length).toBe(1);
              expect(newLoginEmailCalls[0][0]).toMatchObject({
                prefsKey: 'newLogin',
              });
            } else {
              // Property: NewLoginEmail MUST NOT be sent on first login or same IP
              expect(newLoginEmailCalls.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'first login (lastLoginIp is null) never triggers NewLoginEmail regardless of currentIp',
    async () => {
      // Feature: transactional-email, Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set
      // Validates: Requirements 4.3
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(), // any current IP
          async (currentIp) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
            mockComparePasswords.mockResolvedValue(true);
            mockSignToken.mockReturnValue('mock-token');
            mockExpenseFind.mockResolvedValue([]);
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // First login: lastLoginIp is null
            const mockUser = makeMockUser({ lastLoginIp: null });

            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            const request = makeRequest(
              { email: 'user@example.com', password: 'password123' },
              currentIp
            );
            const response = await POST(request);

            expect(response.status).toBe(200);

            // Property: no NewLoginEmail on first login
            const newLoginEmailCalls = mockSendEmail.mock.calls.filter(
              (call) => call[0]?.prefsKey === 'newLogin'
            );
            expect(newLoginEmailCalls.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'same IP login never triggers NewLoginEmail',
    async () => {
      // Feature: transactional-email, Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set
      // Validates: Requirements 4.4
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(), // same IP for both lastLoginIp and currentIp
          async (ip) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
            mockComparePasswords.mockResolvedValue(true);
            mockSignToken.mockReturnValue('mock-token');
            mockExpenseFind.mockResolvedValue([]);
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // lastLoginIp === currentIp (same IP login)
            const mockUser = makeMockUser({ lastLoginIp: ip });

            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            const request = makeRequest(
              { email: 'user@example.com', password: 'password123' },
              ip
            );
            const response = await POST(request);

            expect(response.status).toBe(200);

            // Property: no NewLoginEmail when IP is unchanged
            const newLoginEmailCalls = mockSendEmail.mock.calls.filter(
              (call) => call[0]?.prefsKey === 'newLogin'
            );
            expect(newLoginEmailCalls.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'different IP login always triggers NewLoginEmail when lastLoginIp is set',
    async () => {
      // Feature: transactional-email, Property 8: NewLoginEmail is sent only when IP changes and lastLoginIp is already set
      // Validates: Requirements 4.1
      await fc.assert(
        fc.asyncProperty(
          // Generate two distinct IPs
          fc.tuple(fc.ipV4(), fc.ipV4()).filter(([a, b]) => a !== b),
          async ([lastLoginIp, currentIp]) => {
            vi.clearAllMocks();
            mockCheckRateLimit.mockResolvedValue(rateLimitSuccess);
            mockComparePasswords.mockResolvedValue(true);
            mockSignToken.mockReturnValue('mock-token');
            mockExpenseFind.mockResolvedValue([]);
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // lastLoginIp is set and differs from currentIp
            const mockUser = makeMockUser({ lastLoginIp });

            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            const request = makeRequest(
              { email: 'user@example.com', password: 'password123' },
              currentIp
            );
            const response = await POST(request);

            expect(response.status).toBe(200);

            // Property: NewLoginEmail MUST be sent when IP changed from a known IP
            const newLoginEmailCalls = mockSendEmail.mock.calls.filter(
              (call) => call[0]?.prefsKey === 'newLogin'
            );
            expect(newLoginEmailCalls.length).toBe(1);
            expect(newLoginEmailCalls[0][0]).toMatchObject({
              prefsKey: 'newLogin',
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
