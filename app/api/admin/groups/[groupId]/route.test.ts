/**
 * Unit tests for app/api/admin/groups/[groupId]/route.ts — GET handler
 *
 * Validates: Requirements 1.5, 1.6, 1.7, 1.8
 *
 * Tests:
 *  - 404 when group does not exist (Req 1.5)
 *  - 401 when not admin (Req 1.6)
 *  - Pagination defaults (page=1) and boundary values (Req 1.7, 1.8)
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
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock('@/lib/models/Expense', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/models/Settlement', () => ({
  default: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/audit', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notify', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/balance-cache', () => ({
  getGroupBalances: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { requireAdmin } from '@/lib/admin-auth';
import Group from '@/lib/models/Group';
import Expense from '@/lib/models/Expense';
import Settlement from '@/lib/models/Settlement';
import { getGroupBalances } from '@/lib/balance-cache';
import { GET, DELETE } from './route';

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

/** Build a minimal group document */
function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'group123' },
    name: 'Test Group',
    currency: 'USD',
    createdAt: new Date('2024-01-01'),
    inviteToken: 'token-abc',
    inviteExpiresAt: new Date('2025-01-01'),
    members: [
      {
        user: {
          _id: { toString: () => 'user1' },
          name: 'Alice',
          email: 'alice@example.com',
        },
        shareRatio: 50,
      },
      {
        user: {
          _id: { toString: () => 'user2' },
          name: 'Bob',
          email: 'bob@example.com',
        },
        shareRatio: 50,
      },
    ],
    ...overrides,
  };
}

/** Build a minimal expense document */
function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'exp1' },
    description: 'Dinner',
    amount: 1000,
    category: 'food',
    splitType: 'equal',
    paidBy: { name: 'Alice' },
    createdAt: new Date('2024-01-15'),
    isVoided: false,
    voidedAt: null,
    ...overrides,
  };
}

/** Build a minimal settlement document */
function makeSettlement(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'set1' },
    fromUser: { name: 'Bob' },
    toUser: { name: 'Alice' },
    amount: 500,
    method: 'cash',
    status: 'confirmed',
    createdAt: new Date('2024-01-20'),
    ...overrides,
  };
}

/** Create a chainable mock for Mongoose query builder */
function chainableFindMock(docs: unknown[]) {
  const chain = {
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(docs),
  };
  return chain;
}

/** Create a chainable mock for Group.findById */
function chainableFindByIdMock(doc: unknown) {
  const chain = {
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(doc),
  };
  return chain;
}

/** Build a NextRequest with optional query params */
function makeRequest(groupId: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/admin/groups/${groupId}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString());
}

/** Build the route params object */
function makeParams(groupId: string) {
  return { params: Promise.resolve({ groupId }) };
}

/** Set up default mocks for a successful request */
function setupSuccessMocks(groupId = 'group123') {
  mockAdminAuth();

  (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue(
    chainableFindByIdMock(makeGroup())
  );

  (Expense.find as ReturnType<typeof vi.fn>).mockReturnValue(
    chainableFindMock([makeExpense()])
  );
  (Expense.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(1);

  (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
    chainableFindMock([makeSettlement()])
  );
  (Settlement.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(1);

  (getGroupBalances as ReturnType<typeof vi.fn>).mockResolvedValue([
    { userId: 'user1', balance: 500 },
    { userId: 'user2', balance: -500 },
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 1.6 — 401 when not admin
  // -------------------------------------------------------------------------

  describe('401 — not admin (Req 1.6)', () => {
    it('returns 401 when requireAdmin returns an error response', async () => {
      mockUnauthorized();

      const req = makeRequest('group123');
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('does not call dbConnect or any model when not admin', async () => {
      mockUnauthorized();

      const req = makeRequest('group123');
      await GET(req, makeParams('group123'));

      expect(Group.findById).not.toHaveBeenCalled();
      expect(Expense.find).not.toHaveBeenCalled();
      expect(Settlement.find).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.5 — 404 when group does not exist
  // -------------------------------------------------------------------------

  describe('404 — group not found (Req 1.5)', () => {
    it('returns 404 when Group.findById resolves to null', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableFindByIdMock(null)
      );

      const req = makeRequest('nonexistent-group');
      const res = await GET(req, makeParams('nonexistent-group'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Group not found' });
    });

    it('does not fetch expenses or settlements when group is not found', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableFindByIdMock(null)
      );

      const req = makeRequest('nonexistent-group');
      await GET(req, makeParams('nonexistent-group'));

      expect(Expense.find).not.toHaveBeenCalled();
      expect(Settlement.find).not.toHaveBeenCalled();
      expect(getGroupBalances).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.7 & 1.8 — Pagination defaults
  // -------------------------------------------------------------------------

  describe('pagination defaults (Req 1.7, 1.8)', () => {
    it('defaults expensePage and settlementPage to 1 when not provided', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123');
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.expenses.page).toBe(1);
      expect(body.settlements.page).toBe(1);
    });

    it('uses skip=0 (page 1) when no pagination params are provided', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123');
      await GET(req, makeParams('group123'));

      // Page 1 → skip(0)
      const expenseChain = (Expense.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(expenseChain.skip).toHaveBeenCalledWith(0);
      expect(expenseChain.limit).toHaveBeenCalledWith(50);

      const settlementChain = (Settlement.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(settlementChain.skip).toHaveBeenCalledWith(0);
      expect(settlementChain.limit).toHaveBeenCalledWith(50);
    });

    it('uses correct skip value for page 2', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', { expensePage: '2', settlementPage: '2' });
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expenses.page).toBe(2);
      expect(body.settlements.page).toBe(2);

      // Page 2 → skip(50)
      const expenseChain = (Expense.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(expenseChain.skip).toHaveBeenCalledWith(50);

      const settlementChain = (Settlement.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(settlementChain.skip).toHaveBeenCalledWith(50);
    });

    it('enforces limit of 50 per page', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123');
      await GET(req, makeParams('group123'));

      const expenseChain = (Expense.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(expenseChain.limit).toHaveBeenCalledWith(50);

      const settlementChain = (Settlement.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(settlementChain.limit).toHaveBeenCalledWith(50);
    });

    it('clamps page to minimum of 1 when 0 is provided', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', { expensePage: '0', settlementPage: '0' });
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();
      // Math.max(1, 0) → 1
      expect(body.expenses.page).toBe(1);
      expect(body.settlements.page).toBe(1);
    });

    it('clamps page to minimum of 1 when negative value is provided', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', { expensePage: '-5', settlementPage: '-3' });
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expenses.page).toBe(1);
      expect(body.settlements.page).toBe(1);
    });

    it('clamps page to minimum of 1 when non-numeric value is provided', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', { expensePage: 'abc', settlementPage: 'xyz' });
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expenses.page).toBe(1);
      expect(body.settlements.page).toBe(1);
    });

    it('handles independent pagination for expenses and settlements', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123', { expensePage: '3', settlementPage: '1' });
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expenses.page).toBe(3);
      expect(body.settlements.page).toBe(1);

      // Expense page 3 → skip(100); Settlement page 1 → skip(0)
      const expenseChain = (Expense.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(expenseChain.skip).toHaveBeenCalledWith(100);

      const settlementChain = (Settlement.find as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(settlementChain.skip).toHaveBeenCalledWith(0);
    });
  });

  // -------------------------------------------------------------------------
  // Successful response shape
  // -------------------------------------------------------------------------

  describe('200 — successful response', () => {
    it('returns 200 with the expected response shape', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123');
      const res = await GET(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();

      // Group info
      expect(body.group).toMatchObject({
        _id: 'group123',
        name: 'Test Group',
        currency: 'USD',
        memberCount: 2,
      });

      // Members with balances
      expect(body.members).toHaveLength(2);
      const alice = body.members.find((m: { name: string }) => m.name === 'Alice');
      expect(alice).toMatchObject({ userId: 'user1', balance: 500 });

      // Expenses pagination metadata
      expect(body.expenses).toMatchObject({ total: 1, page: 1 });
      expect(body.expenses.data).toHaveLength(1);

      // Settlements pagination metadata
      expect(body.settlements).toMatchObject({ total: 1, page: 1 });
      expect(body.settlements.data).toHaveLength(1);
    });

    it('queries expenses and settlements with the correct groupId', async () => {
      setupSuccessMocks('group-xyz');

      (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableFindByIdMock(makeGroup({ _id: { toString: () => 'group-xyz' } }))
      );

      const req = makeRequest('group-xyz');
      await GET(req, makeParams('group-xyz'));

      expect(Expense.find).toHaveBeenCalledWith(
        expect.objectContaining({ group: 'group-xyz' })
      );
      expect(Expense.countDocuments).toHaveBeenCalledWith({ group: 'group-xyz' });
      expect(Settlement.find).toHaveBeenCalledWith(
        expect.objectContaining({ group: 'group-xyz' })
      );
      expect(Settlement.countDocuments).toHaveBeenCalledWith({ group: 'group-xyz' });
    });

    it('calls getGroupBalances with the correct groupId', async () => {
      setupSuccessMocks();

      const req = makeRequest('group123');
      await GET(req, makeParams('group123'));

      expect(getGroupBalances).toHaveBeenCalledWith('group123');
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/groups/[groupId] — unit tests
// Validates: Requirements 4.4, 4.5, 4.6
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/groups/[groupId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Helpers specific to DELETE tests
  // -------------------------------------------------------------------------

  /** Build a NextRequest with a JSON body for DELETE */
  function makeDeleteRequest(groupId: string, body?: unknown) {
    const url = `http://localhost/api/admin/groups/${groupId}`;
    return new NextRequest(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** Set up mocks for a successful DELETE */
  function setupDeleteSuccessMocks() {
    mockAdminAuth();

    // Group.findById returns a group with members (not lean — DELETE uses .populate without .lean)
    const group = {
      _id: { toString: () => 'group123' },
      name: 'Test Group',
      members: [
        { user: { _id: { toString: () => 'user1' }, name: 'Alice', email: 'alice@example.com' } },
        { user: { _id: { toString: () => 'user2' }, name: 'Bob', email: 'bob@example.com' } },
      ],
    };
    (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue({
      populate: vi.fn().mockResolvedValue(group),
    });

    (Expense.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    (Settlement.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (Expense.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedCount: 3 });
    (Settlement.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedCount: 2 });
    (Group.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  }

  // -------------------------------------------------------------------------
  // Requirement 4.6 — 401 when not admin
  // -------------------------------------------------------------------------

  describe('401 — not admin (Req 4.6)', () => {
    it('returns 401 when requireAdmin returns an error response', async () => {
      mockUnauthorized();

      const req = makeDeleteRequest('group123', { reason: 'spam' });
      const res = await DELETE(req, makeParams('group123'));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('does not call any model when not admin', async () => {
      mockUnauthorized();

      const req = makeDeleteRequest('group123', { reason: 'spam' });
      await DELETE(req, makeParams('group123'));

      expect(Group.findById).not.toHaveBeenCalled();
      expect(Expense.deleteMany).not.toHaveBeenCalled();
      expect(Settlement.deleteMany).not.toHaveBeenCalled();
      expect(Group.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 4.4 — 400 when reason is missing or empty
  // -------------------------------------------------------------------------

  describe('400 — reason missing or empty (Req 4.4)', () => {
    it('returns 400 when reason is absent from the request body', async () => {
      mockAdminAuth();

      const req = makeDeleteRequest('group123', {});
      const res = await DELETE(req, makeParams('group123'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when reason is an empty string', async () => {
      mockAdminAuth();

      const req = makeDeleteRequest('group123', { reason: '' });
      const res = await DELETE(req, makeParams('group123'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when reason is whitespace-only', async () => {
      mockAdminAuth();

      const req = makeDeleteRequest('group123', { reason: '   ' });
      const res = await DELETE(req, makeParams('group123'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when request body is not valid JSON', async () => {
      mockAdminAuth();

      const url = `http://localhost/api/admin/groups/group123`;
      const req = new NextRequest(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const res = await DELETE(req, makeParams('group123'));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('does not delete any documents when reason is missing', async () => {
      mockAdminAuth();

      const req = makeDeleteRequest('group123', {});
      await DELETE(req, makeParams('group123'));

      expect(Expense.deleteMany).not.toHaveBeenCalled();
      expect(Settlement.deleteMany).not.toHaveBeenCalled();
      expect(Group.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 4.5 — 404 when group does not exist
  // -------------------------------------------------------------------------

  describe('404 — group not found (Req 4.5)', () => {
    it('returns 404 when Group.findById resolves to null', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      });

      const req = makeDeleteRequest('nonexistent-group', { reason: 'cleanup' });
      const res = await DELETE(req, makeParams('nonexistent-group'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Group not found' });
    });

    it('does not delete any documents when group is not found', async () => {
      mockAdminAuth();
      (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      });

      const req = makeDeleteRequest('nonexistent-group', { reason: 'cleanup' });
      await DELETE(req, makeParams('nonexistent-group'));

      expect(Expense.deleteMany).not.toHaveBeenCalled();
      expect(Settlement.deleteMany).not.toHaveBeenCalled();
      expect(Group.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 200 — successful deletion
  // -------------------------------------------------------------------------

  describe('200 — successful deletion', () => {
    it('returns 200 with deletedExpenses and deletedSettlements counts', async () => {
      setupDeleteSuccessMocks();

      const req = makeDeleteRequest('group123', { reason: 'Policy violation' });
      const res = await DELETE(req, makeParams('group123'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, deletedExpenses: 3, deletedSettlements: 2 });
    });

    it('calls Group.findByIdAndDelete with the correct groupId', async () => {
      setupDeleteSuccessMocks();

      const req = makeDeleteRequest('group123', { reason: 'Policy violation' });
      await DELETE(req, makeParams('group123'));

      expect(Group.findByIdAndDelete).toHaveBeenCalledWith('group123');
    });

    it('calls Expense.deleteMany and Settlement.deleteMany with the correct groupId', async () => {
      setupDeleteSuccessMocks();

      const req = makeDeleteRequest('group123', { reason: 'Policy violation' });
      await DELETE(req, makeParams('group123'));

      expect(Expense.deleteMany).toHaveBeenCalledWith({ group: 'group123' });
      expect(Settlement.deleteMany).toHaveBeenCalledWith({ group: 'group123' });
    });
  });
});
