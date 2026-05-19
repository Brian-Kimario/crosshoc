/**
 * Property-Based Tests — Cross-cutting reason validation
 *
 * Feature: admin-enhanced-controls, Property 3: Empty/whitespace reason is always rejected for destructive actions
 * Validates: Requirements 2.5, 3.5, 4.4, 5.5
 *
 * This file tests that every destructive admin endpoint rejects absent, empty,
 * or whitespace-only `reason` values with HTTP 400 and leaves the target
 * document unmodified.
 *
 * Currently covers:
 *   - POST /api/admin/expenses/[expenseId]/void
 *
 * Extend this file when the other routes are implemented:
 *   - DELETE /api/admin/groups/[groupId]/members/[userId]
 *   - DELETE /api/admin/groups/[groupId]
 *   - POST /api/admin/settlements/[settlementId]/void
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports that pull in the modules
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

import { POST } from '@/app/api/admin/expenses/[expenseId]/void/route';
import { requireAdmin } from '@/lib/admin-auth';
import Expense from '@/lib/models/Expense';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Generators for invalid reasons
// ---------------------------------------------------------------------------

/**
 * Produces an arbitrary that generates invalid reason values:
 *   - empty string ""
 *   - undefined (absent)
 *   - null
 *   - whitespace-only strings (spaces, tabs, newlines, combinations)
 */
const invalidReasonArb = fc.oneof(
  // Empty string
  fc.constant(''),
  // Absent (undefined) — will be omitted from the body
  fc.constant(undefined),
  // Null
  fc.constant(null),
  // Whitespace-only strings: spaces, tabs, newlines, carriage returns
  fc.string({ unit: fc.constantFrom(' ', '\t', '\n', '\r', '\u00a0') }).filter(
    (s) => s.length > 0 && s.trim() === ''
  )
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock expense document that tracks whether save() was called. */
function makeMockExpense() {
  return {
    _id: { toString: () => 'expense-id-123' },
    description: 'Test expense',
    amount: 1000,
    isVoided: false,
    voidedAt: null,
    group: { toString: () => 'group-id-456' },
    splits: [],
    save: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
      return this;
    }),
  };
}

/**
 * Build a NextRequest for the void-expense endpoint.
 * When `reason` is undefined the key is omitted from the body entirely,
 * simulating an absent field.
 */
function makeVoidExpenseRequest(reason: string | null | undefined): NextRequest {
  const body =
    reason === undefined
      ? JSON.stringify({}) // absent — key not present
      : JSON.stringify({ reason });

  return new NextRequest(
    'http://localhost/api/admin/expenses/test-id/void',
    {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/** Build the params object expected by the route handler. */
function makeParams(expenseId = 'expense-id-123') {
  return { params: Promise.resolve({ expenseId }) };
}

// ---------------------------------------------------------------------------
// Property 3: Empty/whitespace reason is always rejected — Void Expense
// ---------------------------------------------------------------------------

describe(
  'POST /api/admin/expenses/[expenseId]/void — Property 3: Empty/whitespace reason is always rejected',
  () => {
    // Feature: admin-enhanced-controls, Property 3: Empty/whitespace reason is always rejected for destructive actions

    beforeEach(() => {
      vi.clearAllMocks();

      // Admin auth always succeeds for these tests — we are isolating reason validation
      (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { userId: 'admin-user-id', name: 'Admin User' },
        error: null,
      });
    });

    it(
      'returns HTTP 400 and does not call save() for any absent, empty, or whitespace-only reason',
      async () => {
        // Feature: admin-enhanced-controls, Property 3: Empty/whitespace reason is always rejected for destructive actions
        // Validates: Requirements 2.5, 3.5, 4.4, 5.5
        await fc.assert(
          fc.asyncProperty(
            invalidReasonArb,
            async (invalidReason) => {
              vi.clearAllMocks();

              // Re-apply admin auth mock after clearAllMocks
              (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
                session: { userId: 'admin-user-id', name: 'Admin User' },
                error: null,
              });

              // Arrange: a valid, non-voided expense exists in the DB
              const mockExpense = makeMockExpense();
              (Expense.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockExpense);

              const req = makeVoidExpenseRequest(invalidReason);
              const params = makeParams();

              // Act
              const response = await POST(req, params);
              const body = await response.json();

              // Assert: HTTP 400
              expect(response.status).toBe(400);

              // Assert: error message indicates reason is required
              expect(body).toHaveProperty('error');
              expect(typeof body.error).toBe('string');
              expect(body.error.length).toBeGreaterThan(0);

              // Assert: the expense document was NOT saved (document unchanged)
              expect(mockExpense.save).not.toHaveBeenCalled();

              // Assert: isVoided and voidedAt remain at their original values
              expect(mockExpense.isVoided).toBe(false);
              expect(mockExpense.voidedAt).toBeNull();
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);
