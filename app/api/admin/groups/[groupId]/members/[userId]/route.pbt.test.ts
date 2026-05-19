/**
 * Property-Based Tests for DELETE /api/admin/groups/[groupId]/members/[userId]
 *
 * Feature: admin-enhanced-controls, Property 4: Remove member removes exactly that member
 * Validates: Requirements 3.1
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

import { DELETE } from './route';
import { requireAdmin } from '@/lib/admin-auth';
import Group from '@/lib/models/Group';
import User from '@/lib/models/User';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock group document with the given member IDs. */
function makeMockGroup(memberIds: string[]) {
  const members = memberIds.map((id) => ({
    user: { toString: () => id },
  }));

  const group = {
    _id: { toString: () => 'group-id-123' },
    name: 'Test Group',
    members,
  };

  return group;
}

/** Build a NextRequest with a JSON body containing the given reason. */
function makeRequest(reason: string): NextRequest {
  return new NextRequest(
    'http://localhost/api/admin/groups/group-id-123/members/user-to-remove',
    {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/** Build the params object expected by the route handler. */
function makeParams(groupId: string, userId: string) {
  return { params: Promise.resolve({ groupId, userId }) };
}

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe(
  'DELETE /api/admin/groups/[groupId]/members/[userId] — Property 4: Remove member removes exactly that member',
  () => {
    // Feature: admin-enhanced-controls, Property 4: Remove member removes exactly that member

    beforeEach(() => {
      vi.clearAllMocks();

      // Default: admin auth succeeds
      (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { userId: 'admin-user-id', name: 'Admin User' },
        error: null,
      });
    });

    it(
      'removes exactly the targeted member and leaves all other members present',
      async () => {
        // Feature: admin-enhanced-controls, Property 4: Remove member removes exactly that member
        // Validates: Requirements 3.1
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
            async (memberIds) => {
              vi.clearAllMocks();

              // Re-apply admin auth mock after clearAllMocks
              (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
                session: { userId: 'admin-user-id', name: 'Admin User' },
                error: null,
              });

              // Pick the first member to remove
              const memberToRemove = memberIds[0];
              const remainingMembers = memberIds.slice(1);

              // Arrange: create a mock group with the generated member IDs
              const mockGroup = makeMockGroup(memberIds);

              // Mock Group.findById to return the group
              (Group.findById as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroup);

              // Mock Group.updateOne to simulate the $pull operation:
              // actually remove the member from the in-memory array
              (Group.updateOne as ReturnType<typeof vi.fn>).mockImplementation(
                async (_filter: unknown, update: { $pull?: { members?: { user: unknown } } }) => {
                  const pullUser = update?.$pull?.members?.user;
                  if (pullUser) {
                    const pullUserStr = pullUser.toString();
                    mockGroup.members = mockGroup.members.filter(
                      (m) => m.user.toString() !== pullUserStr
                    );
                  }
                  return { modifiedCount: 1 };
                }
              );

              // Mock User.findById to return a user with a name
              (User.findById as ReturnType<typeof vi.fn>).mockReturnValue({
                select: vi.fn().mockReturnValue({
                  lean: vi.fn().mockResolvedValue({ name: 'Test User' }),
                }),
              });

              const req = makeRequest('Admin removal reason');
              const params = makeParams('group-id-123', memberToRemove);

              // Act: call the DELETE handler
              const response = await DELETE(req, params);
              const body = await response.json();

              // Assert: response is successful
              expect(response.status).toBe(200);
              expect(body.success).toBe(true);

              // Assert: the removed member is no longer in the group's members array
              const memberIdsAfter = mockGroup.members.map((m) => m.user.toString());
              expect(memberIdsAfter).not.toContain(memberToRemove);

              // Assert: all other members are still present
              for (const remainingId of remainingMembers) {
                expect(memberIdsAfter).toContain(remainingId);
              }
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);
