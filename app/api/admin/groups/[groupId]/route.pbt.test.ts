/**
 * Property-Based Tests for DELETE /api/admin/groups/[groupId]
 *
 * Feature: admin-enhanced-controls, Property 5: Delete group removes all associated documents
 * Validates: Requirements 4.1
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

vi.mock('@/lib/balance-cache', () => ({
  getGroupBalances: vi.fn().mockResolvedValue([]),
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

import { DELETE } from './route';
import { requireAdmin } from '@/lib/admin-auth';
import Group from '@/lib/models/Group';
import Expense from '@/lib/models/Expense';
import Settlement from '@/lib/models/Settlement';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock group document with the given member IDs. */
function makeMockGroup(groupId: string, memberIds: string[]) {
  const members = memberIds.map((id) => ({
    user: {
      _id: { toString: () => id },
      toString: () => id,
    },
  }));

  return {
    _id: { toString: () => groupId },
    name: 'Test Group',
    members,
  };
}

/** Build a NextRequest with a JSON body containing the given reason. */
function makeRequest(reason: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/groups/test-group-id', {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build the params object expected by the route handler. */
function makeParams(groupId: string) {
  return { params: Promise.resolve({ groupId }) };
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe(
  'DELETE /api/admin/groups/[groupId] — Property 5: Delete group removes all associated documents',
  () => {
    // Feature: admin-enhanced-controls, Property 5: Delete group removes all associated documents

    beforeEach(() => {
      vi.clearAllMocks();

      // Default: admin auth succeeds
      (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { userId: 'admin-user-id', name: 'Admin User' },
        error: null,
      });
    });

    it(
      'calls deleteMany for expenses and settlements with the groupId, and findByIdAndDelete for the group',
      async () => {
        // Feature: admin-enhanced-controls, Property 5: Delete group removes all associated documents
        // Validates: Requirements 4.1
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 0, max: 20 }),
            fc.integer({ min: 0, max: 10 }),
            async (expenseCount, settlementCount) => {
              vi.clearAllMocks();

              // Re-apply admin auth mock after clearAllMocks
              (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
                session: { userId: 'admin-user-id', name: 'Admin User' },
                error: null,
              });

              const groupId = 'test-group-id';

              // Arrange: create a mock group with members
              const mockGroup = makeMockGroup(groupId, ['member-1', 'member-2']);

              // Mock Group.findById to return the group (non-lean, for DELETE)
              (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue({
                populate: vi.fn().mockResolvedValue(mockGroup),
              });

              // Mock Expense.countDocuments to return expenseCount
              (Expense.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(expenseCount);

              // Mock Settlement.countDocuments to return settlementCount
              (Settlement.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(settlementCount);

              // Mock Expense.deleteMany to return { deletedCount: expenseCount }
              (Expense.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
                deletedCount: expenseCount,
              });

              // Mock Settlement.deleteMany to return { deletedCount: settlementCount }
              (Settlement.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
                deletedCount: settlementCount,
              });

              // Mock Group.findByIdAndDelete to resolve successfully
              (Group.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroup);

              const req = makeRequest('Admin deletion reason');
              const params = makeParams(groupId);

              // Act: call the DELETE handler
              const response = await DELETE(req, params);
              const body = await response.json();

              // Assert: response is successful
              expect(response.status).toBe(200);
              expect(body.success).toBe(true);
              expect(body.deletedExpenses).toBe(expenseCount);
              expect(body.deletedSettlements).toBe(settlementCount);

              // Assert: Expense.deleteMany was called with { group: groupId }
              expect(Expense.deleteMany).toHaveBeenCalledWith({ group: groupId });

              // Assert: Settlement.deleteMany was called with { group: groupId }
              expect(Settlement.deleteMany).toHaveBeenCalledWith({ group: groupId });

              // Assert: Group.findByIdAndDelete was called with the groupId
              expect(Group.findByIdAndDelete).toHaveBeenCalledWith(groupId);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);

// ---------------------------------------------------------------------------
// Property 6: Delete group notifies all members
// ---------------------------------------------------------------------------

import { notify } from '@/lib/notify';

describe(
  'DELETE /api/admin/groups/[groupId] — Property 6: Delete group notifies all members',
  () => {
    // Feature: admin-enhanced-controls, Property 6: Delete group notifies all members

    beforeEach(() => {
      vi.clearAllMocks();

      // Default: admin auth succeeds
      (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { userId: 'admin-user-id', name: 'Admin User' },
        error: null,
      });
    });

    it(
      'calls notify() exactly once per member with the correct userId',
      async () => {
        // Feature: admin-enhanced-controls, Property 6: Delete group notifies all members
        // Validates: Requirements 4.3
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
            async (memberIds) => {
              vi.clearAllMocks();

              // Re-apply admin auth mock after clearAllMocks
              (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
                session: { userId: 'admin-user-id', name: 'Admin User' },
                error: null,
              });

              const groupId = 'test-group-id';

              // Arrange: create a mock group with the generated member IDs
              const mockGroup = makeMockGroup(groupId, memberIds);

              // Mock Group.findById to return the group
              (Group.findById as ReturnType<typeof vi.fn>).mockReturnValue({
                populate: vi.fn().mockResolvedValue(mockGroup),
              });

              // Mock Expense.countDocuments and Settlement.countDocuments
              (Expense.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);
              (Settlement.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

              // Mock Expense.deleteMany and Settlement.deleteMany
              (Expense.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedCount: 0 });
              (Settlement.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ deletedCount: 0 });

              // Mock Group.findByIdAndDelete to resolve successfully
              (Group.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroup);

              // Mock notify to resolve successfully
              (notify as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

              const req = makeRequest('Admin deletion reason');
              const params = makeParams(groupId);

              // Act: call the DELETE handler
              const response = await DELETE(req, params);
              const body = await response.json();

              // Flush fire-and-forget promises
              await new Promise(resolve => setTimeout(resolve, 0));

              // Assert: response is successful
              expect(response.status).toBe(200);
              expect(body.success).toBe(true);

              // Assert: notify was called exactly once per member
              const notifyCalls = (notify as ReturnType<typeof vi.fn>).mock.calls;
              expect(notifyCalls.length).toBe(memberIds.length);

              // Assert: each notify call was made with the correct userId
              const notifiedUserIds = notifyCalls.map((call: any[]) => call[0].userId);
              for (const memberId of memberIds) {
                expect(notifiedUserIds).toContain(memberId);
              }
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);
