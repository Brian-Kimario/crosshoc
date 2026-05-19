/**
 * Property-based tests for POST /api/auth/reset-password route.
 *
 * Feature: transactional-email, Property 4: Password reset succeeds for valid tokens and fails for invalid ones
 *
 * Validates: Requirements 2.5, 2.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSave, mockUserFindOne, mockSendEmail, mockHashPassword } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockUserFindOne = vi.fn();
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockHashPassword = vi.fn().mockImplementation((pw: string) =>
    Promise.resolve(`hashed_${pw}`)
  );

  return { mockSave, mockUserFindOne, mockSendEmail, mockHashPassword };
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

// Mock sendEmail to prevent actual email sends
vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

// Mock PasswordChangedEmail template
vi.mock('@/emails/PasswordChangedEmail', () => ({
  PasswordChangedEmail: vi.fn(() => null),
}));

// Mock hashPassword from lib/auth
vi.mock('@/lib/auth', () => ({
  hashPassword: mockHashPassword,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/auth/reset-password/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest with a JSON body */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Build a mock user object with a save() method */
function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    email: 'user@example.com',
    name: 'Test User',
    password: 'old_hashed_password',
    passwordResetToken: 'some_hash',
    passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour from now
    tokenVersion: 0,
    save: mockSave,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property 4: Password reset succeeds for valid tokens and fails for invalid ones
// ---------------------------------------------------------------------------

describe('Property 4: Password reset succeeds for valid tokens and fails for invalid ones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHashPassword.mockImplementation((pw: string) => Promise.resolve(`hashed_${pw}`));
    mockSave.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);
  });

  it(
    'valid token: HTTP 200, password updated, fields cleared, tokenVersion incremented',
    async () => {
      // Feature: transactional-email, Property 4: Password reset succeeds for valid tokens and fails for invalid ones
      // Validates: Requirements 2.5, 2.6
      await fc.assert(
        fc.asyncProperty(
          // Use alphanumeric strings to avoid whitespace-only values that the route rejects
          fc.stringMatching(/^[a-zA-Z0-9]{1,64}$/),  // token
          fc.stringMatching(/^[a-zA-Z0-9!@#$%]{8,64}$/),  // new password (minLength 8)
          fc.integer({ min: 0, max: 100 }), // initial tokenVersion
          async (token, newPassword, initialTokenVersion) => {
            vi.clearAllMocks();
            mockHashPassword.mockImplementation((pw: string) => Promise.resolve(`hashed_${pw}`));
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // For valid case: mock User.findOne to return a user
            // (simulating hash match + non-expired token)
            const mockUser = makeMockUser({ tokenVersion: initialTokenVersion });
            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(mockUser),
            });

            const request = makeRequest({ token, password: newPassword });
            const response = await POST(request);

            // Assert HTTP 200
            expect(response.status).toBe(200);

            // Assert password was updated (hashed)
            expect(mockUser.password).toBe(`hashed_${newPassword}`);

            // Assert passwordResetToken cleared
            expect(mockUser.passwordResetToken).toBeNull();

            // Assert passwordResetExpires cleared
            expect(mockUser.passwordResetExpires).toBeNull();

            // Assert tokenVersion incremented
            expect(mockUser.tokenVersion).toBe(initialTokenVersion + 1);

            // Assert user was saved
            expect(mockSave).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'invalid token: HTTP 400, password unchanged',
    async () => {
      // Feature: transactional-email, Property 4: Password reset succeeds for valid tokens and fails for invalid ones
      // Validates: Requirements 2.5, 2.6
      await fc.assert(
        fc.asyncProperty(
          // Use alphanumeric strings to avoid whitespace-only values that trigger a different 400 path
          fc.stringMatching(/^[a-zA-Z0-9]{1,64}$/),  // token (wrong value or expired)
          fc.stringMatching(/^[a-zA-Z0-9!@#$%]{8,64}$/),  // new password (minLength 8)
          async (token, newPassword) => {
            vi.clearAllMocks();
            mockHashPassword.mockImplementation((pw: string) => Promise.resolve(`hashed_${pw}`));
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // For invalid case: mock User.findOne to return null
            // (simulating hash mismatch or expired token)
            mockUserFindOne.mockReturnValue({
              select: vi.fn().mockResolvedValue(null),
            });

            const originalPassword = 'old_hashed_password';

            const request = makeRequest({ token, password: newPassword });
            const response = await POST(request);

            // Assert HTTP 400
            expect(response.status).toBe(400);

            // Assert password was NOT changed (save never called)
            expect(mockSave).not.toHaveBeenCalled();
            expect(mockHashPassword).not.toHaveBeenCalled();

            // Assert error message is the generic invalid/expired message
            const body = await response.json();
            expect(body.error).toBe('Invalid or expired reset token.');

            // Suppress unused variable warning
            void originalPassword;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'valid and invalid cases combined: behavior determined by token validity',
    async () => {
      // Feature: transactional-email, Property 4: Password reset succeeds for valid tokens and fails for invalid ones
      // Validates: Requirements 2.5, 2.6
      await fc.assert(
        fc.asyncProperty(
          // Use alphanumeric strings to avoid whitespace-only values that trigger input validation 400
          fc.stringMatching(/^[a-zA-Z0-9]{1,64}$/),  // token
          fc.stringMatching(/^[a-zA-Z0-9!@#$%]{8,64}$/),  // new password (minLength 8)
          fc.boolean(),                  // isValid: true = valid token, false = invalid
          fc.integer({ min: 0, max: 50 }), // initial tokenVersion
          async (token, newPassword, isValid, initialTokenVersion) => {
            vi.clearAllMocks();
            mockHashPassword.mockImplementation((pw: string) => Promise.resolve(`hashed_${pw}`));
            mockSave.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            if (isValid) {
              // Valid case: mock User.findOne to return a user
              const mockUser = makeMockUser({ tokenVersion: initialTokenVersion });
              mockUserFindOne.mockReturnValue({
                select: vi.fn().mockResolvedValue(mockUser),
              });

              const request = makeRequest({ token, password: newPassword });
              const response = await POST(request);

              // Valid: HTTP 200, password updated, fields cleared, tokenVersion incremented
              expect(response.status).toBe(200);
              expect(mockUser.password).toBe(`hashed_${newPassword}`);
              expect(mockUser.passwordResetToken).toBeNull();
              expect(mockUser.passwordResetExpires).toBeNull();
              expect(mockUser.tokenVersion).toBe(initialTokenVersion + 1);
              expect(mockSave).toHaveBeenCalledOnce();
            } else {
              // Invalid case: mock User.findOne to return null
              mockUserFindOne.mockReturnValue({
                select: vi.fn().mockResolvedValue(null),
              });

              const request = makeRequest({ token, password: newPassword });
              const response = await POST(request);

              // Invalid: HTTP 400, password unchanged
              expect(response.status).toBe(400);
              expect(mockSave).not.toHaveBeenCalled();
              expect(mockHashPassword).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
