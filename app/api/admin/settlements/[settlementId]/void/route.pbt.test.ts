/**
 * Property-Based Tests for POST /api/admin/settlements/[settlementId]/void
 *
 * Feature: admin-enhanced-controls, Property 7: Void settlement sets correct fields
 * Validates: Requirements 5.1
 *
 * Feature: admin-enhanced-controls, Property 8: Void settlement notifies both parties
 * Validates: Requirements 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

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
import { notify } from '@/lib/notify';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_USER_ID = 'admin-user-id-abc';
const ADMIN_NAME = 'Admin User';

/** Build a mock settlement document with the given amount and status. */
function makeMockSettlement(amount: number, status: string) {
  const settlement: Record<string, unknown> = {
    _id: { toString: () => 'settlement-id-123' },
    amount,
    status,
    adminNote: null,
    resolvedByAdmin: null,
    resolvedAt: null,
    group: { _id: { toString: () => 'group-id-456' }, name: 'Test Group', toString: () => 'group-id-456' },
    fromUser: { _id: { toString: () => 'from-user-id-789' }, name: 'Alice', email: 'alice@example.com', toString: () => 'from-user-id-789' },
    toUser: { _id: { toString: () => 'to-user-id-012' }, name: 'Bob', email: 'bob@example.com', toString: () => 'to-user-id-012' },
    save: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
      // Simulate Mongoose save: the object is mutated in place
      return this;
    }),
  };
  return settlement;
}

/** Create a chainable mock for Settlement.findById that supports .populate() chaining */
function chainableSettlementMock(doc: Record<string, unknown> | null) {
  const chain = {
    populate: vi.fn().mockReturnThis(),
  };
  (chain as any).then = (resolve: (v: unknown) => void) => Promise.resolve(doc).then(resolve);
  return chain;
}

/** Build a NextRequest with a JSON body containing the given reason. */
function makeRequest(reason: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/settlements/test-id/void', {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build the params object expected by the route handler. */
function makeParams(settlementId = 'settlement-id-123') {
  return { params: Promise.resolve({ settlementId }) };
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/settlements/[settlementId]/void — Property 7: Void settlement sets correct fields', () => {
  // Feature: admin-enhanced-controls, Property 7: Void settlement sets correct fields

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: admin auth succeeds
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { userId: ADMIN_USER_ID, name: ADMIN_NAME },
      error: null,
    });
  });

  it(
    'sets status === "voided", adminNote === reason.trim(), and resolvedByAdmin === adminId for any valid settlement data',
    async () => {
      // Feature: admin-enhanced-controls, Property 7: Void settlement sets correct fields
      // Validates: Requirements 5.1
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            amount: fc.integer({ min: 1 }),
            status: fc.constantFrom('pending', 'confirmed', 'disputed'),
          }),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async ({ amount, status }, reason) => {
            vi.clearAllMocks();

            // Re-apply admin auth mock after clearAllMocks
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
              session: { userId: ADMIN_USER_ID, name: ADMIN_NAME },
              error: null,
            });

            // Arrange: create a mock settlement document with the generated data
            const mockSettlement = makeMockSettlement(amount, status);

            (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
              chainableSettlementMock(mockSettlement)
            );

            const req = makeRequest(reason);
            const params = makeParams();

            // Act: call the POST handler
            const response = await POST(req, params);
            const body = await response.json();

            // Assert: response is successful
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            // Assert: the settlement document was mutated correctly
            // Property 7: status === "voided" && adminNote === reason && resolvedByAdmin === adminId
            expect(mockSettlement.status).toBe('voided');
            expect(mockSettlement.adminNote).toBe(reason.trim());
            expect(mockSettlement.resolvedByAdmin).toBe(ADMIN_USER_ID);

            // Assert: save was called
            expect(mockSettlement.save).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 8: Void settlement notifies both parties
// ---------------------------------------------------------------------------

describe('POST /api/admin/settlements/[settlementId]/void — Property 8: Void settlement notifies both parties', () => {
  // Feature: admin-enhanced-controls, Property 8: Void settlement notifies both parties
  // Validates: Requirements 5.4

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { userId: ADMIN_USER_ID, name: ADMIN_NAME },
      error: null,
    });
  });

  it(
    'calls notify exactly twice — once for fromUser and once for toUser — for any valid settlement parties',
    async () => {
      // Feature: admin-enhanced-controls, Property 8: Void settlement notifies both parties
      // Validates: Requirements 5.4
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromUser: fc.string({ minLength: 1 }),
            toUser: fc.string({ minLength: 1 }),
          }),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async ({ fromUser, toUser }, reason) => {
            vi.clearAllMocks();

            // Re-apply admin auth mock after clearAllMocks
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
              session: { userId: ADMIN_USER_ID, name: ADMIN_NAME },
              error: null,
            });

            // Arrange: build a settlement with the generated fromUser / toUser IDs
            const mockSettlement: Record<string, unknown> = {
              _id: { toString: () => 'settlement-id-p8' },
              amount: 1000,
              status: 'confirmed',
              adminNote: null,
              resolvedByAdmin: null,
              resolvedAt: null,
              group: { _id: { toString: () => 'group-id-p8' }, name: 'Test Group', toString: () => 'group-id-p8' },
              fromUser: { _id: { toString: () => fromUser }, name: 'Alice', email: 'alice@example.com', toString: () => fromUser },
              toUser: { _id: { toString: () => toUser }, name: 'Bob', email: 'bob@example.com', toString: () => toUser },
              save: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
                return this;
              }),
            };

            (Settlement.findById as ReturnType<typeof vi.fn>).mockReturnValue(
              chainableSettlementMock(mockSettlement)
            );

            const req = makeRequest(reason);
            const params = makeParams('settlement-id-p8');

            // Act
            const response = await POST(req, params);
            const body = await response.json();

            // Assert: request succeeded
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            // Allow fire-and-forget microtasks to flush
            await Promise.resolve();

            // Assert: notify was called exactly twice
            const notifyMock = notify as ReturnType<typeof vi.fn>;
            expect(notifyMock).toHaveBeenCalledTimes(2);

            // Assert: the two notify calls target fromUser and toUser respectively
            const calledUserIds = notifyMock.mock.calls.map(
              (call: unknown[]) => (call[0] as { userId: string }).userId
            );
            expect(calledUserIds).toContain(fromUser);
            expect(calledUserIds).toContain(toUser);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
