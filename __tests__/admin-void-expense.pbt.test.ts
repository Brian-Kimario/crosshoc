/**
 * Property-Based Tests for POST /api/admin/expenses/[expenseId]/void/route.ts
 *
 * Feature: transactional-email, Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry
 * Validates: Requirements 6.1
 *
 * For any expense with N entries in its `splits` array, an admin void-expense
 * operation must result in exactly N sendEmail() calls with the ExpenseVoidedEmail
 * template — one per split entry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSendEmail,
  mockRequireAdmin,
  mockDbConnect,
  mockExpenseFindById,
  mockInvalidateBalanceCache,
  mockLogAction,
  mockNotify,
} = vi.hoisted(() => {
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockRequireAdmin = vi.fn();
  const mockDbConnect = vi.fn().mockResolvedValue(undefined);
  const mockExpenseFindById = vi.fn();
  const mockInvalidateBalanceCache = vi.fn().mockResolvedValue(undefined);
  const mockLogAction = vi.fn().mockResolvedValue(undefined);
  const mockNotify = vi.fn().mockResolvedValue(undefined);

  return {
    mockSendEmail,
    mockRequireAdmin,
    mockDbConnect,
    mockExpenseFindById,
    mockInvalidateBalanceCache,
    mockLogAction,
    mockNotify,
  };
});

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull in the modules
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}));

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock('@/lib/db', () => ({
  default: mockDbConnect,
}));

vi.mock('@/lib/models/Expense', () => ({
  default: {
    findById: mockExpenseFindById,
  },
}));

vi.mock('@/lib/balance-cache', () => ({
  invalidateBalanceCache: mockInvalidateBalanceCache,
}));

vi.mock('@/lib/audit', () => ({
  logAction: mockLogAction,
}));

vi.mock('@/lib/notify', () => ({
  notify: mockNotify,
}));

vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// ExpenseVoidedEmail template — return null so the mock is valid
vi.mock('@/emails/ExpenseVoidedEmail', () => ({
  ExpenseVoidedEmail: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/admin/expenses/[expenseId]/void/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest for the POST handler with a valid reason body. */
function makePostRequest(reason = 'Violated terms of service'): NextRequest {
  return new NextRequest('http://localhost/api/admin/expenses/test-expense-id/void', {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build the params object expected by the route handler. */
function makeParams(expenseId = 'test-expense-id') {
  return { params: Promise.resolve({ expenseId }) };
}

/**
 * Build a mock expense document with the given splits.
 * Each split has a populated `user` sub-document with name and email.
 */
function makeMockExpense(splits: Array<{ name: string; email: string }>) {
  return {
    _id: { toString: () => 'test-expense-id' },
    isVoided: false,
    description: 'Test Expense',
    amount: 1250,
    group: {
      _id: { toString: () => 'group-id' },
      name: 'Test Group',
    },
    splits: splits.map((s, i) => ({
      user: {
        _id: { toString: () => `user-id-${i}` },
        name: s.name,
        email: s.email,
      },
      amount: 100,
    })),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry
// ---------------------------------------------------------------------------

describe('Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry', () => {
  // Feature: transactional-email, Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry

  beforeEach(() => {
    vi.clearAllMocks();

    // Admin auth always succeeds
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'admin-id', name: 'Admin User' },
      error: null,
    });

    // DB and side-effect operations succeed
    mockDbConnect.mockResolvedValue(undefined);
    mockInvalidateBalanceCache.mockResolvedValue(undefined);
    mockLogAction.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);

    process.env.SUPPORT_EMAIL = 'support@spliteasy.app';
  });

  it(
    'calls sendEmail exactly once per split entry with prefsKey "expenseVoided"',
    async () => {
      // Feature: transactional-email, Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry
      // Validates: Requirements 6.1
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              email: fc.emailAddress(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (splits) => {
            vi.clearAllMocks();

            // Re-apply mocks after clearAllMocks
            mockRequireAdmin.mockResolvedValue({
              session: { userId: 'admin-id', name: 'Admin User' },
              error: null,
            });
            mockDbConnect.mockResolvedValue(undefined);
            mockInvalidateBalanceCache.mockResolvedValue(undefined);
            mockLogAction.mockResolvedValue(undefined);
            mockNotify.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // Arrange: set up mock expense with the generated splits
            const mockExpense = makeMockExpense(splits);
            mockExpenseFindById.mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockResolvedValue(mockExpense),
              }),
            });

            const req = makePostRequest();
            const params = makeParams();

            // Act: call the POST handler
            const response = await POST(req, params);
            const body = await response.json();

            // Assert: handler returned success
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            // Flush fire-and-forget microtasks (sendEmail is called without await)
            await Promise.resolve();
            await Promise.resolve();

            // Assert: sendEmail was called exactly once per split entry
            // Property 10: sendEmail call count === splits.length
            expect(mockSendEmail).toHaveBeenCalledTimes(splits.length);

            // Assert: every call uses prefsKey 'expenseVoided'
            for (const call of mockSendEmail.mock.calls) {
              expect(call[0]).toMatchObject({ prefsKey: 'expenseVoided' });
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'each sendEmail call targets the correct split user email address',
    async () => {
      // Feature: transactional-email, Property 10: Admin void-expense sends one ExpenseVoidedEmail per split entry
      // Validates: Requirements 6.1
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              email: fc.emailAddress(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (splits) => {
            vi.clearAllMocks();

            mockRequireAdmin.mockResolvedValue({
              session: { userId: 'admin-id', name: 'Admin User' },
              error: null,
            });
            mockDbConnect.mockResolvedValue(undefined);
            mockInvalidateBalanceCache.mockResolvedValue(undefined);
            mockLogAction.mockResolvedValue(undefined);
            mockNotify.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            const mockExpense = makeMockExpense(splits);
            mockExpenseFindById.mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockResolvedValue(mockExpense),
              }),
            });

            const req = makePostRequest();
            const params = makeParams();

            const response = await POST(req, params);
            expect(response.status).toBe(200);

            // Flush fire-and-forget microtasks
            await Promise.resolve();
            await Promise.resolve();

            // Collect all 'to' addresses from sendEmail calls
            const calledEmails = mockSendEmail.mock.calls.map(
              (call: unknown[]) => (call[0] as { to: string }).to
            );

            // Every split user email must appear in the sendEmail calls
            for (const split of splits) {
              expect(calledEmails).toContain(split.email);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
