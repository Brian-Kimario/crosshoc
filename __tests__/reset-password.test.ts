/**
 * Unit tests for POST /api/auth/reset-password route.
 *
 * Validates: Requirements 2.5, 2.6
 *
 * Tests:
 * 1. Returns 400 for expired token (passwordResetExpires in the past)
 * 2. Returns 400 for wrong token value (hash doesn't match)
 * 3. Clears passwordResetToken and passwordResetExpires on success
 * 4. Increments tokenVersion on success
 * 5. Returns 400 when token or password missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockSave, mockUserFindOne, mockSendEmail, mockHashPassword } = vi.hoisted(() => {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockUserFindOne = vi.fn();
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockHashPassword = vi.fn().mockResolvedValue('hashed_new_password');

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
    name: 'Alice',
    password: 'old_hashed_password',
    passwordResetToken: 'some_hash',
    passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour from now
    tokenVersion: 0,
    save: mockSave,
    ...overrides,
  };
}

/** Default: findOne returns null (token not found / expired) */
function mockUserNotFound() {
  mockUserFindOne.mockReturnValue({
    select: vi.fn().mockResolvedValue(null),
  });
}

/** Default: findOne returns a valid user */
function mockUserFound(overrides: Record<string, unknown> = {}) {
  mockUserFindOne.mockReturnValue({
    select: vi.fn().mockResolvedValue(makeMockUser(overrides)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user not found (expired/wrong token)
    mockUserNotFound();
  });

  // -------------------------------------------------------------------------
  // Requirement 2.6 — Returns 400 for expired token
  // -------------------------------------------------------------------------

  describe('expired token (Requirement 2.6)', () => {
    it('returns 400 when token is expired', async () => {
      // The route queries with passwordResetExpires > Date.now(),
      // so an expired token means User.findOne returns null
      mockUserNotFound();

      const request = makeRequest({ token: 'some_valid_looking_token', password: 'NewPassword123!' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns generic invalid/expired message for expired token', async () => {
      mockUserNotFound();

      const request = makeRequest({ token: 'expired_token', password: 'NewPassword123!' });
      const response = await POST(request);
      const body = await response.json();

      expect(body.error).toBe('Invalid or expired reset token.');
    });

    it('does not update password when token is expired', async () => {
      mockUserNotFound();

      const request = makeRequest({ token: 'expired_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockSave).not.toHaveBeenCalled();
      expect(mockHashPassword).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.6 — Returns 400 for wrong token value
  // -------------------------------------------------------------------------

  describe('wrong token value (Requirement 2.6)', () => {
    it('returns 400 when token hash does not match', async () => {
      // The route hashes the submitted token and queries by hash;
      // if no user is found, the hash didn't match
      mockUserNotFound();

      const request = makeRequest({ token: 'wrong_token_value', password: 'NewPassword123!' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns generic invalid/expired message for wrong token', async () => {
      mockUserNotFound();

      const request = makeRequest({ token: 'wrong_token_value', password: 'NewPassword123!' });
      const response = await POST(request);
      const body = await response.json();

      expect(body.error).toBe('Invalid or expired reset token.');
    });

    it('does not update password when token is wrong', async () => {
      mockUserNotFound();

      const request = makeRequest({ token: 'wrong_token_value', password: 'NewPassword123!' });
      await POST(request);

      expect(mockSave).not.toHaveBeenCalled();
      expect(mockHashPassword).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.5 — Clears token fields on success
  // -------------------------------------------------------------------------

  describe('clears token fields on success (Requirement 2.5)', () => {
    it('sets passwordResetToken to null on success', async () => {
      const mockUser = makeMockUser();
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockUser.passwordResetToken).toBeNull();
    });

    it('sets passwordResetExpires to null on success', async () => {
      const mockUser = makeMockUser();
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockUser.passwordResetExpires).toBeNull();
    });

    it('saves the user after clearing token fields', async () => {
      mockUserFound();

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockSave).toHaveBeenCalledOnce();
    });

    it('returns 200 on success', async () => {
      mockUserFound();

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('returns success message on success', async () => {
      mockUserFound();

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      const response = await POST(request);
      const body = await response.json();

      expect(body.message).toBe('Password reset successfully.');
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.5 — Increments tokenVersion on success
  // -------------------------------------------------------------------------

  describe('increments tokenVersion on success (Requirement 2.5)', () => {
    it('increments tokenVersion by 1 on success', async () => {
      const mockUser = makeMockUser({ tokenVersion: 3 });
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockUser.tokenVersion).toBe(4);
    });

    it('increments tokenVersion from 0 to 1 on first reset', async () => {
      const mockUser = makeMockUser({ tokenVersion: 0 });
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockUser.tokenVersion).toBe(1);
    });

    it('does not increment tokenVersion when token is invalid', async () => {
      mockUserNotFound();

      const request = makeRequest({ token: 'invalid_token', password: 'NewPassword123!' });
      await POST(request);

      // save was never called, so tokenVersion was never changed
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.5 — Updates password on success
  // -------------------------------------------------------------------------

  describe('password update on success (Requirement 2.5)', () => {
    it('hashes the new password before storing', async () => {
      const mockUser = makeMockUser();
      mockUserFindOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockHashPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(mockUser.password).toBe('hashed_new_password');
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 2.5 — Returns 400 when token or password missing
  // -------------------------------------------------------------------------

  describe('input validation (Requirement 2.5)', () => {
    it('returns 400 when token is missing', async () => {
      const request = makeRequest({ password: 'NewPassword123!' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
      const request = makeRequest({ token: 'some_token' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when both token and password are missing', async () => {
      const request = makeRequest({});
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when token is empty string', async () => {
      const request = makeRequest({ token: '', password: 'NewPassword123!' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when password is empty string', async () => {
      const request = makeRequest({ token: 'some_token', password: '' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns error message when token is missing', async () => {
      const request = makeRequest({ password: 'NewPassword123!' });
      const response = await POST(request);
      const body = await response.json();

      expect(body.error).toBe('token and password are required');
    });

    it('returns error message when password is missing', async () => {
      const request = makeRequest({ token: 'some_token' });
      const response = await POST(request);
      const body = await response.json();

      expect(body.error).toBe('token and password are required');
    });

    it('returns 400 when request body is invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('does not look up user when token is missing', async () => {
      const request = makeRequest({ password: 'NewPassword123!' });
      await POST(request);

      expect(mockUserFindOne).not.toHaveBeenCalled();
    });

    it('does not look up user when password is missing', async () => {
      const request = makeRequest({ token: 'some_token' });
      await POST(request);

      expect(mockUserFindOne).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 3.4 — Sends PasswordChangedEmail on success (security-critical)
  // -------------------------------------------------------------------------

  describe('sends PasswordChangedEmail on success (Requirement 3.4)', () => {
    it('calls sendEmail after successful password reset', async () => {
      mockUserFound();

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockSendEmail).toHaveBeenCalledOnce();
    });

    it('does not call sendEmail when token is invalid', async () => {
      mockUserNotFound();

      const request = makeRequest({ token: 'invalid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('sends email to the user email address', async () => {
      mockUserFound({ email: 'alice@example.com' });

      const request = makeRequest({ token: 'valid_token', password: 'NewPassword123!' });
      await POST(request);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@example.com' })
      );
    });
  });
});
