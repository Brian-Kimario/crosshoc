/**
 * Unit tests for POST /api/admin/users/[userId]/reset-password
 *
 * Validates: Requirements 7.5, 7.6
 *
 * Tests:
 *  - 404 when user does not exist (Req 7.5)
 *  - 200 for valid user — verifies logAction called with correct action string (Req 7.2)
 *  - 401 when not admin (Req 7.6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull in the modules
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/models/User', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { POST } from './route';
import { requireAdmin } from '@/lib/admin-auth';
import User from '@/lib/models/User';
import { logAction } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  name: 'Admin User',
  isAdmin: true as const,
};

const TARGET_USER_ID = 'target-user-id-123';
const TARGET_USER_EMAIL = 'user@example.com';

function mockAdminAuth() {
  (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: ADMIN_SESSION,
    error: null,
  });
}

function mockUnauthorized() {
  const errorResponse = new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
  (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: null,
    error: errorResponse,
  });
}

function makeRequest(userId = TARGET_USER_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/users/${userId}/reset-password`,
    { method: 'POST' }
  );
}

function makeParams(userId = TARGET_USER_ID) {
  return { params: Promise.resolve({ userId }) };
}

function mockUserFound() {
  (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: { toString: () => TARGET_USER_ID },
      name: 'Test User',
      email: TARGET_USER_EMAIL,
      passwordResetToken: null,
      passwordResetExpires: null,
      save: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

function mockUserNotFound() {
  (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockResolvedValue(null),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/[userId]/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 7.6 — 401 when not admin
  // -------------------------------------------------------------------------

  describe('401 — not admin (Req 7.6)', () => {
    it('returns 401 when requireAdmin returns an error response', async () => {
      mockUnauthorized();

      const res = await POST(makeRequest(), makeParams());

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('does not call User.findById when not admin', async () => {
      mockUnauthorized();

      await POST(makeRequest(), makeParams());

      expect(User.findById).not.toHaveBeenCalled();
    });

    it('does not call logAction when not admin', async () => {
      mockUnauthorized();

      await POST(makeRequest(), makeParams());

      expect(logAction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 7.5 — 404 when user does not exist
  // -------------------------------------------------------------------------

  describe('404 — user not found (Req 7.5)', () => {
    it('returns 404 when User.findById resolves to null', async () => {
      mockAdminAuth();
      mockUserNotFound();

      const res = await POST(makeRequest(), makeParams('nonexistent-user'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'User not found' });
    });

    it('does not call logAction when user is not found', async () => {
      mockAdminAuth();
      mockUserNotFound();

      await POST(makeRequest(), makeParams('nonexistent-user'));

      // Allow fire-and-forget microtasks to flush
      await Promise.resolve();

      expect(logAction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 7.2 — 200 for valid user, logAction called with correct action
  // -------------------------------------------------------------------------

  describe('200 — valid user (Req 7.2)', () => {
    it('returns 200 with success: true', async () => {
      mockAdminAuth();
      mockUserFound();

      const res = await POST(makeRequest(), makeParams());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('calls logAction with action "user.admin_password_reset_triggered"', async () => {
      mockAdminAuth();
      mockUserFound();

      await POST(makeRequest(), makeParams());

      // Allow fire-and-forget microtasks to flush
      await Promise.resolve();

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.admin_password_reset_triggered',
        })
      );
    });

    it('includes the target email in the logAction after field', async () => {
      mockAdminAuth();
      mockUserFound();

      await POST(makeRequest(), makeParams());

      await Promise.resolve();

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.admin_password_reset_triggered',
          after: expect.objectContaining({
            email: TARGET_USER_EMAIL,
          }),
        })
      );
    });

    it('includes the admin actorId and actorName in the logAction call', async () => {
      mockAdminAuth();
      mockUserFound();

      await POST(makeRequest(), makeParams());

      await Promise.resolve();

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ADMIN_SESSION.userId,
          actorName: ADMIN_SESSION.name,
        })
      );
    });

    it('does not expose or set the password in the response', async () => {
      mockAdminAuth();
      mockUserFound();

      const res = await POST(makeRequest(), makeParams());
      const body = await res.json();

      expect(body).not.toHaveProperty('password');
      expect(JSON.stringify(body)).not.toContain('password');
    });

    it('fetches the user with password reset fields selected', async () => {
      mockAdminAuth();
      mockUserFound();

      await POST(makeRequest(), makeParams());

      const findByIdCall = (User.findById as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(findByIdCall[0]).toBe(TARGET_USER_ID);

      // Verify .select("+passwordResetToken +passwordResetExpires") was called
      const selectMock = (User.findById as ReturnType<typeof vi.fn>).mock.results[0].value.select;
      expect(selectMock).toHaveBeenCalledWith('+passwordResetToken +passwordResetExpires');
    });
  });
});
