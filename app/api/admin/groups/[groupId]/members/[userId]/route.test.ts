/**
 * Unit tests for app/api/admin/groups/[groupId]/members/[userId]/route.ts — DELETE handler
 *
 * Validates: Requirements 3.6, 3.7, 3.8
 *
 * Tests:
 *  - 404 when group does not exist (Req 3.6)
 *  - 404 when user is not a member of the group (Req 3.7)
 *  - 401 when not admin (Req 3.8)
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

vi.mock('@/lib/models/Group', () => ({
  default: {
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('@/lib/models/User', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/balance-cache', () => ({
  invalidateBalanceCache: vi.fn().mockResolvedValue(undefined),
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

import { requireAdmin } from '@/lib/admin-auth';
import Group from '@/lib/models/Group';
import User from '@/lib/models/User';
import { invalidateBalanceCache } from '@/lib/balance-cache';
import { logAction } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { DELETE } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  userId: 'admin1',
  email: 'admin@example.com',
  name: 'Admin User',
  isAdmin: true as const,
};

/** Make requireAdmin resolve as an authenticated admin */
function mockAdminAuth() {
  (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: ADMIN_SESSION,
    error: null,
  });
}

/** Make requireAdmin resolve as unauthorized (401) */
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

/** Build a minimal group document with members */
function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'group123' },
    name: 'Test Group',
    members: [
      {
        user: { toString: () => 'user1' },
        shareRatio: 50,
      },
      {
        user: { toString: () => 'user2' },
        shareRatio: 50,
      },
    ],
    ...overrides,
  };
}

/** Build a minimal user document */
function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'user1' },
    name: 'Alice',
    ...overrides,
  };
}

/** Build a NextRequest with a JSON body */
function makeRequest(
  groupId: string,
  userId: string,
  body: Record<string, unknown> = { reason: 'Violating group rules' }
) {
  const url = `http://localhost/api/admin/groups/${groupId}/members/${userId}`;
  return new NextRequest(url, {
    method: 'DELETE',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build the route params object */
function makeParams(groupId: string, userId: string) {
  return { params: Promise.resolve({ groupId, userId }) };
}

/** Set up default mocks for a successful request */
function setupSuccessMocks() {
  mockAdminAuth();

  (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeGroup());
  (Group.updateOne as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 1 });

  (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(makeUser()),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/groups/[groupId]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 3.8 — 401 when not admin
  // -------------------------------------------------------------------------

  describe('401 — not admin (Req 3.8)', () => {
    it('returns 401 when requireAdmin returns an error response', async () => {
      mockUnauthorized();

      const req = makeRequest('group123', 'user1');
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('does not call dbConnect or any model when not admin', async () => {
      mockUnauthorized();

      const req = makeRequest('group123', 'user1');
      await DELETE(req, makeParams('group123', 'user1'));

      expect(Group.findById).not.toHaveBeenCalled();
      expect(Group.updateOne).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 3.6 — 404 when group does not exist
  // -------------------------------------------------------------------------

  describe('404 — group not found (Req 3.6)', () => {
    it('returns 404 when Group.findById resolves to null', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = makeRequest('nonexistent-group', 'user1');
      const res = await DELETE(req, makeParams('nonexistent-group', 'user1'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Group not found' });
    });

    it('does not call Group.updateOne when group is not found', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = makeRequest('nonexistent-group', 'user1');
      await DELETE(req, makeParams('nonexistent-group', 'user1'));

      expect(Group.updateOne).not.toHaveBeenCalled();
    });

    it('does not call invalidateBalanceCache when group is not found', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = makeRequest('nonexistent-group', 'user1');
      await DELETE(req, makeParams('nonexistent-group', 'user1'));

      expect(invalidateBalanceCache).not.toHaveBeenCalled();
    });

    it('does not call notify when group is not found', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = makeRequest('nonexistent-group', 'user1');
      await DELETE(req, makeParams('nonexistent-group', 'user1'));

      expect(notify).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 3.7 — 404 when user is not a member of the group
  // -------------------------------------------------------------------------

  describe('404 — user not a member (Req 3.7)', () => {
    it('returns 404 when userId is not in group.members', async () => {
      mockAdminAuth();
      // Group exists but does not contain 'nonmember-user'
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeGroup());

      const req = makeRequest('group123', 'nonmember-user');
      const res = await DELETE(req, makeParams('group123', 'nonmember-user'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Member not found in group' });
    });

    it('does not call Group.updateOne when user is not a member', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeGroup());

      const req = makeRequest('group123', 'nonmember-user');
      await DELETE(req, makeParams('group123', 'nonmember-user'));

      expect(Group.updateOne).not.toHaveBeenCalled();
    });

    it('does not call invalidateBalanceCache when user is not a member', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeGroup());

      const req = makeRequest('group123', 'nonmember-user');
      await DELETE(req, makeParams('group123', 'nonmember-user'));

      expect(invalidateBalanceCache).not.toHaveBeenCalled();
    });

    it('does not call notify when user is not a member', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeGroup());

      const req = makeRequest('group123', 'nonmember-user');
      await DELETE(req, makeParams('group123', 'nonmember-user'));

      expect(notify).not.toHaveBeenCalled();
    });

    it('returns 404 when group has no members at all', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeGroup({ members: [] })
      );

      const req = makeRequest('group123', 'user1');
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Member not found in group' });
    });
  });

  // -------------------------------------------------------------------------
  // 400 — missing or empty reason
  // -------------------------------------------------------------------------

  describe('400 — missing or empty reason', () => {
    it('returns 400 when reason is missing from body', async () => {
      mockAdminAuth();

      const req = makeRequest('group123', 'user1', {});
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when reason is an empty string', async () => {
      mockAdminAuth();

      const req = makeRequest('group123', 'user1', { reason: '' });
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when reason is whitespace-only', async () => {
      mockAdminAuth();

      const req = makeRequest('group123', 'user1', { reason: '   ' });
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when body is not valid JSON', async () => {
      mockAdminAuth();

      const url = 'http://localhost/api/admin/groups/group123/members/user1';
      const req = new NextRequest(url, {
        method: 'DELETE',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });
  });

  // -------------------------------------------------------------------------
  // 200 — successful removal
  // -------------------------------------------------------------------------

  describe('200 — successful removal', () => {
    it('returns 200 with { success: true } on valid request', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', 'user1');
      const res = await DELETE(req, makeParams('group123', 'user1'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it('calls Group.updateOne with $pull to remove the member', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', 'user1');
      await DELETE(req, makeParams('group123', 'user1'));

      expect(Group.updateOne).toHaveBeenCalledWith(
        { _id: 'group123' },
        expect.objectContaining({ $pull: expect.any(Object) })
      );
    });

    it('calls invalidateBalanceCache with the correct groupId', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', 'user1');
      await DELETE(req, makeParams('group123', 'user1'));

      // Allow the fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 0));

      expect(invalidateBalanceCache).toHaveBeenCalledWith('group123');
    });

    it('calls logAction with action "member.admin_removed"', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', 'user1');
      await DELETE(req, makeParams('group123', 'user1'));

      await new Promise((r) => setTimeout(r, 0));

      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'member.admin_removed' })
      );
    });

    it('calls notify for the removed user', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', 'user1');
      await DELETE(req, makeParams('group123', 'user1'));

      await new Promise((r) => setTimeout(r, 0));

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1' })
      );
    });
  });
});
