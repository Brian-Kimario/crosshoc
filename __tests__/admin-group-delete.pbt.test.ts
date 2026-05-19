/**
 * Property-Based Tests for DELETE /api/admin/groups/[groupId]/route.ts
 *
 * Feature: transactional-email, Property 9: Admin group-delete sends one GroupDeletedEmail per member
 * Validates: Requirements 5.2
 *
 * For any group with N members, an admin delete-group operation must result in
 * exactly N sendEmail() calls with the GroupDeletedEmail template — one per
 * member at the time of deletion.
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
  mockGroupFindById,
  mockExpenseDeleteMany,
  mockExpenseCountDocuments,
  mockSettlementDeleteMany,
  mockSettlementCountDocuments,
  mockGroupFindByIdAndDelete,
  mockLogAction,
  mockNotify,
} = vi.hoisted(() => {
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);
  const mockRequireAdmin = vi.fn();
  const mockDbConnect = vi.fn().mockResolvedValue(undefined);
  const mockGroupFindById = vi.fn();
  const mockExpenseDeleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
  const mockExpenseCountDocuments = vi.fn().mockResolvedValue(0);
  const mockSettlementDeleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });
  const mockSettlementCountDocuments = vi.fn().mockResolvedValue(0);
  const mockGroupFindByIdAndDelete = vi.fn().mockResolvedValue(null);
  const mockLogAction = vi.fn().mockResolvedValue(undefined);
  const mockNotify = vi.fn().mockResolvedValue(undefined);

  return {
    mockSendEmail,
    mockRequireAdmin,
    mockDbConnect,
    mockGroupFindById,
    mockExpenseDeleteMany,
    mockExpenseCountDocuments,
    mockSettlementDeleteMany,
    mockSettlementCountDocuments,
    mockGroupFindByIdAndDelete,
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

vi.mock('@/lib/models/Group', () => ({
  default: {
    findById: mockGroupFindById,
    findByIdAndDelete: mockGroupFindByIdAndDelete,
  },
}));

vi.mock('@/lib/models/Expense', () => ({
  default: {
    deleteMany: mockExpenseDeleteMany,
    countDocuments: mockExpenseCountDocuments,
  },
}));

vi.mock('@/lib/models/Settlement', () => ({
  default: {
    deleteMany: mockSettlementDeleteMany,
    countDocuments: mockSettlementCountDocuments,
  },
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

// GroupDeletedEmail template — return a simple element so the mock is valid
vi.mock('@/emails/GroupDeletedEmail', () => ({
  GroupDeletedEmail: vi.fn().mockReturnValue(null),
}));

// balance-cache is used by GET but not DELETE; mock it to avoid import errors
vi.mock('@/lib/balance-cache', () => ({
  getGroupBalances: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { DELETE } from '@/app/api/admin/groups/[groupId]/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest for the DELETE handler with a valid reason body. */
function makeDeleteRequest(reason = 'Violated terms of service'): NextRequest {
  return new NextRequest('http://localhost/api/admin/groups/test-group-id', {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build the params object expected by the route handler. */
function makeParams(groupId = 'test-group-id') {
  return { params: Promise.resolve({ groupId }) };
}

/**
 * Build a mock group document with the given members.
 * Each member has a populated `user` sub-document with name and email.
 */
function makeMockGroup(members: Array<{ name: string; email: string }>) {
  return {
    _id: { toString: () => 'test-group-id' },
    name: 'Test Group',
    members: members.map((m, i) => ({
      user: {
        _id: { toString: () => `user-id-${i}` },
        name: m.name,
        email: m.email,
      },
      shareRatio: 100,
    })),
  };
}

// ---------------------------------------------------------------------------
// Property 9: Admin group-delete sends one GroupDeletedEmail per member
// ---------------------------------------------------------------------------

describe('Property 9: Admin group-delete sends one GroupDeletedEmail per member', () => {
  // Feature: transactional-email, Property 9: Admin group-delete sends one GroupDeletedEmail per member

  beforeEach(() => {
    vi.clearAllMocks();

    // Admin auth always succeeds
    mockRequireAdmin.mockResolvedValue({
      session: { userId: 'admin-id', name: 'Admin User' },
      error: null,
    });

    // DB operations succeed
    mockDbConnect.mockResolvedValue(undefined);
    mockExpenseDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockExpenseCountDocuments.mockResolvedValue(0);
    mockSettlementDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockSettlementCountDocuments.mockResolvedValue(0);
    mockGroupFindByIdAndDelete.mockResolvedValue(null);
    mockLogAction.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);

    process.env.SUPPORT_EMAIL = 'support@spliteasy.app';
  });

  it(
    'calls sendEmail exactly once per member with prefsKey "groupDeleted"',
    async () => {
      // Feature: transactional-email, Property 9: Admin group-delete sends one GroupDeletedEmail per member
      // Validates: Requirements 5.2
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              email: fc.emailAddress(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (members) => {
            vi.clearAllMocks();

            // Re-apply mocks after clearAllMocks
            mockRequireAdmin.mockResolvedValue({
              session: { userId: 'admin-id', name: 'Admin User' },
              error: null,
            });
            mockDbConnect.mockResolvedValue(undefined);
            mockExpenseDeleteMany.mockResolvedValue({ deletedCount: 0 });
            mockExpenseCountDocuments.mockResolvedValue(0);
            mockSettlementDeleteMany.mockResolvedValue({ deletedCount: 0 });
            mockSettlementCountDocuments.mockResolvedValue(0);
            mockGroupFindByIdAndDelete.mockResolvedValue(null);
            mockLogAction.mockResolvedValue(undefined);
            mockNotify.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // Arrange: set up mock group with the generated members
            const mockGroup = makeMockGroup(members);
            mockGroupFindById.mockReturnValue({
              populate: vi.fn().mockResolvedValue(mockGroup),
            });

            const req = makeDeleteRequest();
            const params = makeParams();

            // Act: call the DELETE handler
            const response = await DELETE(req, params);
            const body = await response.json();

            // Assert: handler returned success
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);

            // Flush fire-and-forget microtasks (sendEmail is called without await)
            await Promise.resolve();
            await Promise.resolve();

            // Assert: sendEmail was called exactly once per member
            // Property 9: sendEmail call count === members.length
            expect(mockSendEmail).toHaveBeenCalledTimes(members.length);

            // Assert: every call uses prefsKey 'groupDeleted'
            for (const call of mockSendEmail.mock.calls) {
              expect(call[0]).toMatchObject({ prefsKey: 'groupDeleted' });
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'each sendEmail call targets the correct member email address',
    async () => {
      // Feature: transactional-email, Property 9: Admin group-delete sends one GroupDeletedEmail per member
      // Validates: Requirements 5.2
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              email: fc.emailAddress(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (members) => {
            vi.clearAllMocks();

            mockRequireAdmin.mockResolvedValue({
              session: { userId: 'admin-id', name: 'Admin User' },
              error: null,
            });
            mockDbConnect.mockResolvedValue(undefined);
            mockExpenseDeleteMany.mockResolvedValue({ deletedCount: 0 });
            mockExpenseCountDocuments.mockResolvedValue(0);
            mockSettlementDeleteMany.mockResolvedValue({ deletedCount: 0 });
            mockSettlementCountDocuments.mockResolvedValue(0);
            mockGroupFindByIdAndDelete.mockResolvedValue(null);
            mockLogAction.mockResolvedValue(undefined);
            mockNotify.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            const mockGroup = makeMockGroup(members);
            mockGroupFindById.mockReturnValue({
              populate: vi.fn().mockResolvedValue(mockGroup),
            });

            const req = makeDeleteRequest();
            const params = makeParams();

            const response = await DELETE(req, params);
            expect(response.status).toBe(200);

            // Flush fire-and-forget microtasks
            await Promise.resolve();
            await Promise.resolve();

            // Collect all 'to' addresses from sendEmail calls
            const calledEmails = mockSendEmail.mock.calls.map(
              (call: unknown[]) => (call[0] as { to: string }).to
            );

            // Every member email must appear in the sendEmail calls
            for (const member of members) {
              expect(calledEmails).toContain(member.email);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
