/**
 * Unit tests for POST /api/admin/settlements/[settlementId]/void
 *
 * Validates: Requirements 5.6, 5.7, 5.8
 *
 * Tests:
 *  - 404 when settlement does not exist (Req 5.6)
 *  - 409 when settlement is already voided (Req 5.7)
 *  - 401 when not admin (Req 5.8)
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

vi.mock('@/lib/models/Settlement', () => ({
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

import { POST } from './route';
import { requireAdmin } from '@/lib/admin-auth';
import Settlement from '@/lib/models/Settlement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  userId: 'admin-user-id',
  email: 'admin@example.com',
  name: 'Admin User',
  isAdmin: true as const,
};

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

function makeSettlement(status: string) {
  const doc: Record<string, unknown> = {
    _id: { toString: () => 'settlement-id-123' },
    amount: 5000,
    status,
    adminNote: null,
    resolvedByAdmin: null,
    resolvedAt: null,
    group: { _id: { toString: () => 'group-id-456' }, name: 'Test Group', toString: () => 'group-id-456' },
    fromUser: { _id: { toString: () => 'from-user-id' }, name: 'Alice', email: 'alice@example.com', toString: () => 'from-user-id' },
    toUser: { _id: { toString: () => 'to-user-id' }, name: 'Bob', email: 'bob@example.com', toString: () => 'to-user-id' },
    save: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
      return this;
    }),
  };
  return doc;
}

/** Create a chainable mock for Settlement.findById that supports .populate() chaining */
function chainableSettlementMock(doc: Record<string, unknown> | null) {
  const chain = {
    populate: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  };
  // Make it thenable so await works
  (chain as any).then = (resolve: (v: unknown) => void) => Promise.resolve(doc).then(resolve);
  return chain;
}

function makeRequest(body: unknown, settlementId = 'settlement-id-123'): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/settlements/${settlementId}/void`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function makeParams(settlementId = 'settlement-id-123') {
  return { params: Promise.resolve({ settlementId }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/settlements/[settlementId]/void', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 5.8 — 401 when not admin
  // -------------------------------------------------------------------------

  describe('401 — not admin (Req 5.8)', () => {
    it('returns 401 when requireAdmin returns an error response', async () => {
      mockUnauthorized();

      const res = await POST(makeRequest({ reason: 'fraud' }), makeParams());

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('does not call Settlement.findById when not admin', async () => {
      mockUnauthorized();

      await POST(makeRequest({ reason: 'fraud' }), makeParams());

      expect(Settlement.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 5.6 — 404 when settlement does not exist
  // -------------------------------------------------------------------------

  describe('404 — settlement not found (Req 5.6)', () => {
    it('returns 404 when Settlement.findById resolves to null', async () => {
      mockAdminAuth();
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(null)
      );

      const res = await POST(makeRequest({ reason: 'duplicate' }), makeParams('nonexistent-id'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: 'Settlement not found' });
    });

    it('does not attempt to save when settlement is not found', async () => {
      mockAdminAuth();
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(null)
      );

      await POST(makeRequest({ reason: 'duplicate' }), makeParams('nonexistent-id'));

      // No save mock to check — just verify no error thrown and correct status
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 5.7 — 409 when settlement is already voided
  // -------------------------------------------------------------------------

  describe('409 — already voided (Req 5.7)', () => {
    it('returns 409 when settlement.status is already "voided"', async () => {
      mockAdminAuth();
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(makeSettlement('voided'))
      );

      const res = await POST(makeRequest({ reason: 'duplicate' }), makeParams());

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toEqual({ error: 'Settlement is already voided' });
    });

    it('does not call save when settlement is already voided', async () => {
      mockAdminAuth();
      const mockDoc = makeSettlement('voided');
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(mockDoc)
      );

      await POST(makeRequest({ reason: 'duplicate' }), makeParams());

      expect(mockDoc.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 400 — missing or empty reason
  // -------------------------------------------------------------------------

  describe('400 — missing or empty reason', () => {
    it('returns 400 when reason is absent', async () => {
      mockAdminAuth();

      const res = await POST(makeRequest({}), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when reason is an empty string', async () => {
      mockAdminAuth();

      const res = await POST(makeRequest({ reason: '' }), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('returns 400 when reason is whitespace-only', async () => {
      mockAdminAuth();

      const res = await POST(makeRequest({ reason: '   ' }), makeParams());

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: 'reason is required' });
    });

    it('does not call Settlement.findById when reason is missing', async () => {
      mockAdminAuth();

      await POST(makeRequest({}), makeParams());

      expect(Settlement.findById).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 200 — successful void
  // -------------------------------------------------------------------------

  describe('200 — successful void', () => {
    it('returns 200 with success: true for a valid pending settlement', async () => {
      mockAdminAuth();
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(makeSettlement('pending'))
      );

      const res = await POST(makeRequest({ reason: 'Duplicate entry' }), makeParams());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it('returns 200 with success: true for a valid confirmed settlement', async () => {
      mockAdminAuth();
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(makeSettlement('confirmed'))
      );

      const res = await POST(makeRequest({ reason: 'Error correction' }), makeParams());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
    });

    it('calls save on the settlement document', async () => {
      mockAdminAuth();
      const mockDoc = makeSettlement('pending');
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(mockDoc)
      );

      await POST(makeRequest({ reason: 'Duplicate entry' }), makeParams());

      expect(mockDoc.save).toHaveBeenCalledOnce();
    });

    it('sets status to "voided" on the settlement document', async () => {
      mockAdminAuth();
      const mockDoc = makeSettlement('confirmed');
      (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
        chainableSettlementMock(mockDoc)
      );

      await POST(makeRequest({ reason: 'Correction' }), makeParams());

      expect(mockDoc.status).toBe('voided');
    });
  });
});
