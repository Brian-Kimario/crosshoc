/**
 * Unit tests for PATCH /api/admin/users/[userId]/profile
 *
 * Validates: Requirements 6.4, 6.6, 6.7, 6.8, 6.10
 *
 * Tests:
 *  - 404 when user does not exist (Req 6.8)
 *  - 409 when email is already in use by another user (Req 6.4)
 *  - 400 when neither name nor email is provided (Req 6.7)
 *  - 400 when name is empty string (Req 6.6)
 *  - 401 when not admin (Req 6.10)
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
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notify', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { PATCH } from './route';
import { requireAdmin } from '@/lib/admin-auth';
import User from '@/lib/models/User';

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

function makeRequest(body: unknown, userId = TARGET_USER_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/users/${userId}/profile`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function makeParams(userId = TARGET_USER_ID) {
  return { params: Promise.resolve({ userId }) };
}

/** Set up User mocks for a successful update */
function setupSuccessMocks(
  originalName = 'Original Name',
  originalEmail = 'original@example.com'
) {
  let findByIdCallCount = 0;
  (User.findById as ReturnType<typeof vi.fn>).mockImplementation(() => {
    findByIdCallCount++;
    if (findByIdCallCount === 1) {
      return {
        select: vi.fn().mockResolvedValue({
          _id: { toString: () => TARGET_USER_ID },
          name: originalName,
          email: originalEmail,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: { toString: () => TARGET_USER_ID },
          name: originalName,
          email: originalEmail,
        }),
      }),
    };
  });
  (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  });
  (User.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/users/[userId]/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 6.10 — 401 when not admin
  // -------------------------------------------------------------------------

  describe('401 — not admin (Req 6.10)', () => {
    it('returns 401 when requireAdmin returns an error response', async () => {
      mockUnauthorized();

      const res = await PATCH(makeRequest({ name: 'New Name' }), makeParams());

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('does not call User.findById when not admin', async () => {
      mockUnauthorized();

      await PATCH(makeRequest({ name: 'New Name' }), makeParams());

      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 6.7 — 400 when neither name nor email is provided
  // -------------------------------------------------------------------------

  describe('400 — no updatable fields provided (Req 6.7)', () => {
    it('returns 400 when request body is empty object', async () => {
      mockAdminAuth();

      const res = await PATCH(makeRequest({}), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Provide name and/or email' });
    });

    it('returns 400 when request body contains only unrelated fields', async () => {
      mockAdminAuth();

      const res = await PATCH(makeRequest({ role: 'admin', isAdmin: true }), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'Provide name and/or email' });
    });

    it('does not call User.findById when no fields are provided', async () => {
      mockAdminAuth();

      await PATCH(makeRequest({}), makeParams());

      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 6.6 — 400 when name is empty string
  // -------------------------------------------------------------------------

  describe('400 — empty name (Req 6.6)', () => {
    it('returns 400 when name is an empty string', async () => {
      mockAdminAuth();

      const res = await PATCH(makeRequest({ name: '' }), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name cannot be empty' });
    });

    it('returns 400 when name is whitespace-only', async () => {
      mockAdminAuth();

      const res = await PATCH(makeRequest({ name: '   ' }), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'name cannot be empty' });
    });

    it('does not call User.findById when name is empty', async () => {
      mockAdminAuth();

      await PATCH(makeRequest({ name: '' }), makeParams());

      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 6.8 — 404 when user does not exist
  // -------------------------------------------------------------------------

  describe('404 — user not found (Req 6.8)', () => {
    it('returns 404 when User.findById resolves to null', async () => {
      mockAdminAuth();
      (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const res = await PATCH(makeRequest({ name: 'New Name' }), makeParams('nonexistent-user'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'User not found' });
    });

    it('does not call findByIdAndUpdate when user is not found', async () => {
      mockAdminAuth();
      (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      await PATCH(makeRequest({ name: 'New Name' }), makeParams('nonexistent-user'));

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 6.4 — 409 when email is already in use by another user
  // -------------------------------------------------------------------------

  describe('409 — email conflict (Req 6.4)', () => {
    it('returns 409 when email is already in use by another user', async () => {
      mockAdminAuth();
      (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: { toString: () => TARGET_USER_ID },
          name: 'Original Name',
          email: 'original@example.com',
        }),
      });
      // Simulate another user with the same email
      (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: 'other-user-id' }),
        }),
      });

      const res = await PATCH(
        makeRequest({ email: 'taken@example.com' }),
        makeParams()
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Email already in use' });
    });

    it('does not call findByIdAndUpdate when email is already in use', async () => {
      mockAdminAuth();
      (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: { toString: () => TARGET_USER_ID },
          name: 'Original Name',
          email: 'original@example.com',
        }),
      });
      (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: 'other-user-id' }),
        }),
      });

      await PATCH(makeRequest({ email: 'taken@example.com' }), makeParams());

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 200 — successful update
  // -------------------------------------------------------------------------

  describe('200 — successful update', () => {
    it('returns 200 with success: true and updated user when name is valid', async () => {
      mockAdminAuth();
      setupSuccessMocks();

      const res = await PATCH(makeRequest({ name: 'New Name' }), makeParams());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.user).toMatchObject({ _id: TARGET_USER_ID });
    });

    it('calls findByIdAndUpdate with $set containing the new name', async () => {
      mockAdminAuth();
      setupSuccessMocks();

      await PATCH(makeRequest({ name: 'New Name' }), makeParams());

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET_USER_ID,
        { $set: { name: 'New Name' } }
      );
    });

    it('trims whitespace from name before saving', async () => {
      mockAdminAuth();
      setupSuccessMocks();

      await PATCH(makeRequest({ name: '  Trimmed Name  ' }), makeParams());

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        TARGET_USER_ID,
        { $set: { name: 'Trimmed Name' } }
      );
    });

    it('never includes password in the $set update', async () => {
      mockAdminAuth();
      setupSuccessMocks();

      await PATCH(makeRequest({ name: 'New Name', password: 'hacked' }), makeParams());

      const updateCall = (User.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
      const setArg = (updateCall[1] as Record<string, unknown>).$set as Record<string, unknown>;
      expect(setArg).not.toHaveProperty('password');
    });
  });
});
