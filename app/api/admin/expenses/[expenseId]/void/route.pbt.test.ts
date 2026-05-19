/**
 * Property-Based Tests for POST /api/admin/expenses/[expenseId]/void
 *
 * Feature: admin-enhanced-controls, Property 1: Void expense sets correct fields
 * Validates: Requirements 2.1
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

vi.mock('@/lib/models/Expense', () => ({
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
import Expense from '@/lib/models/Expense';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock expense document with the given description and amount. */
function makeMockExpense(description: string, amount: number) {
  const expense: Record<string, unknown> = {
    _id: { toString: () => 'expense-id-123' },
    description,
    amount,
    isVoided: false,
    voidedAt: null,
    group: { _id: { toString: () => 'group-id-456' }, name: 'Test Group', toString: () => 'group-id-456' },
    splits: [],
    save: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
      // Simulate Mongoose save: the object is mutated in place
      return this;
    }),
  };
  return expense;
}

/** Create a chainable mock for Expense.findById that supports .populate() chaining */
function chainableExpenseMock(doc: Record<string, unknown> | null) {
  const chain = {
    populate: vi.fn().mockReturnThis(),
  };
  // Make it thenable so await works
  (chain as any).then = (resolve: (v: unknown) => void) => Promise.resolve(doc).then(resolve);
  return chain;
}

/** Build a NextRequest with a JSON body containing the given reason. */
function makeRequest(reason: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/expenses/test-id/void', {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build the params object expected by the route handler. */
function makeParams(expenseId = 'expense-id-123') {
  return { params: Promise.resolve({ expenseId }) };
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/expenses/[expenseId]/void — Property 1: Void expense sets correct fields', () => {
  // Feature: admin-enhanced-controls, Property 1: Void expense sets correct fields

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: admin auth succeeds
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { userId: 'admin-user-id', name: 'Admin User' },
      error: null,
    });
  });

  it(
    'sets isVoided === true and voidedAt instanceof Date for any valid expense data',
    async () => {
      // Feature: admin-enhanced-controls, Property 1: Void expense sets correct fields
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            description: fc.string(),
            amount: fc.integer({ min: 1 }),
          }),
          async ({ description, amount }) => {
            vi.clearAllMocks();

            // Re-apply admin auth mock after clearAllMocks
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
              session: { userId: 'admin-user-id', name: 'Admin User' },
              error: null,
            });

            // Arrange: create a mock expense document
            const mockExpense = makeMockExpense(description, amount);

            (Expense.findById as ReturnType<typeof vi.fn>).mockReturnValue(
              chainableExpenseMock(mockExpense)
            );

            const req = makeRequest('Admin correction reason');
            const params = makeParams();

            // Act: call the POST handler
            const response = await POST(req, params);
            const body = await response.json();

            // Assert: response is successful
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            // Assert: the expense document was mutated correctly
            expect(mockExpense.isVoided).toBe(true);
            expect(mockExpense.voidedAt).toBeInstanceOf(Date);

            // Assert: save was called
            expect(mockExpense.save).toHaveBeenCalledOnce();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 2: Void expense notifies all split members
// ---------------------------------------------------------------------------

import { notify } from '@/lib/notify';

describe('POST /api/admin/expenses/[expenseId]/void — Property 2: Void expense notifies all split members', () => {
  // Feature: admin-enhanced-controls, Property 2: Void expense notifies all split members

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: admin auth succeeds
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { userId: 'admin-user-id', name: 'Admin User' },
      error: null,
    });
  });

  it(
    'calls notify() exactly once per split member, with the correct userId',
    async () => {
      // Feature: admin-enhanced-controls, Property 2: Void expense notifies all split members
      // Validates: Requirements 2.4
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
          async (splitUserIds) => {
            vi.clearAllMocks();

            // Re-apply admin auth mock after clearAllMocks
            (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
              session: { userId: 'admin-user-id', name: 'Admin User' },
              error: null,
            });

            // Arrange: build splits from the generated user IDs
            const splits = splitUserIds.map((userId) => ({
              user: { _id: { toString: () => userId }, toString: () => userId },
              amount: 100,
            }));

            const mockExpense: Record<string, unknown> = {
              _id: { toString: () => 'expense-id-123' },
              description: 'Test expense',
              amount: 1000,
              isVoided: false,
              voidedAt: null,
              group: { _id: { toString: () => 'group-id-456' }, name: 'Test Group', toString: () => 'group-id-456' },
              splits,
              save: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
                return this;
              }),
            };

            (Expense.findById as ReturnType<typeof vi.fn>).mockReturnValue(
              chainableExpenseMock(mockExpense)
            );

            const req = makeRequest('Admin correction reason');
            const params = makeParams();

            // Act: call the POST handler
            const response = await POST(req, params);
            const body = await response.json();

            // Assert: response is successful
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            // Flush all fire-and-forget promises
            await new Promise((resolve) => setTimeout(resolve, 0));

            // Assert: notify was called exactly splits.length times
            const notifyMock = notify as ReturnType<typeof vi.fn>;
            const notifyCalls = notifyMock.mock.calls;
            expect(notifyCalls.length).toBe(splits.length);

            // Assert: each call was made with the correct userId
            const calledUserIds = notifyCalls.map((call) => call[0].userId as string);
            expect(calledUserIds).toEqual(splitUserIds);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
