/**
 * Property-based tests for GET /api/cron/invite-expiring route.
 *
 * Feature: transactional-email, Property 11: Cron sets expiringSoonEmailSentAt after processing each token
 *
 * Validates: Requirements 8.3, 5.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockDbConnect,
  mockInviteTokenFind,
  mockInviteTokenFindByIdAndUpdate,
  mockGroupFindById,
  mockUserFindById,
  mockSendEmail,
} = vi.hoisted(() => {
  const mockDbConnect = vi.fn().mockResolvedValue(undefined);
  const mockInviteTokenFind = vi.fn();
  const mockInviteTokenFindByIdAndUpdate = vi.fn().mockResolvedValue(undefined);
  const mockGroupFindById = vi.fn();
  const mockUserFindById = vi.fn();
  const mockSendEmail = vi.fn().mockResolvedValue(undefined);

  return {
    mockDbConnect,
    mockInviteTokenFind,
    mockInviteTokenFindByIdAndUpdate,
    mockGroupFindById,
    mockUserFindById,
    mockSendEmail,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// server-only throws in test environments; mock it as a no-op
vi.mock('server-only', () => ({}));

// Mock db connect — no-op
vi.mock('@/lib/db', () => ({ default: mockDbConnect }));

// Mock InviteToken model
vi.mock('@/lib/models/InviteToken', () => ({
  default: {
    find: mockInviteTokenFind,
    findByIdAndUpdate: mockInviteTokenFindByIdAndUpdate,
  },
}));

// Mock Group model
vi.mock('@/lib/models/Group', () => ({
  default: {
    findById: mockGroupFindById,
  },
}));

// Mock User model
vi.mock('@/lib/models/User', () => ({
  default: {
    findById: mockUserFindById,
  },
}));

// Mock sendEmail
vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
}));

// Mock InviteExpiringSoonEmail template
vi.mock('@/emails/InviteExpiringSoonEmail', () => ({
  default: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/cron/invite-expiring/route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = 'test-cron-secret-pbt-abc123';

/** Build a NextRequest with the correct Authorization header */
function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/invite-expiring', {
    method: 'GET',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

// ---------------------------------------------------------------------------
// Property 11: Cron sets expiringSoonEmailSentAt after processing each token
// ---------------------------------------------------------------------------

/**
 * Feature: transactional-email, Property 11: Cron sets expiringSoonEmailSentAt after processing each token
 *
 * Validates: Requirements 8.3, 5.6
 */
describe('Property 11: Cron sets expiringSoonEmailSentAt after processing each token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;

    // Default: Group and User lookups succeed for any id
    mockGroupFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: 'group-id',
          name: 'Test Group',
        }),
      }),
    });

    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: 'user-id',
          email: 'creator@example.com',
          name: 'Creator User',
        }),
      }),
    });

    mockInviteTokenFindByIdAndUpdate.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it(
    'calls findByIdAndUpdate with expiringSoonEmailSentAt for every qualifying token',
    async () => {
      // Feature: transactional-email, Property 11: Cron sets expiringSoonEmailSentAt after processing each token
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({ id: fc.string({ minLength: 1 }) }),
            { minLength: 1, maxLength: 10 }
          ),
          async (tokenDefs) => {
            vi.clearAllMocks();

            // Re-apply default mocks after clearAllMocks
            mockGroupFindById.mockReturnValue({
              select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                  _id: 'group-id',
                  name: 'Test Group',
                }),
              }),
            });

            mockUserFindById.mockReturnValue({
              select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                  _id: 'user-id',
                  email: 'creator@example.com',
                  name: 'Creator User',
                }),
              }),
            });

            mockInviteTokenFindByIdAndUpdate.mockResolvedValue(undefined);
            mockSendEmail.mockResolvedValue(undefined);

            // Build token objects matching the shape returned by InviteToken.find().lean()
            const tokens = tokenDefs.map(({ id }) => ({
              _id: id,
              groupId: `group-${id}`,
              createdBy: `user-${id}`,
              expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
            }));

            mockInviteTokenFind.mockReturnValue({
              lean: vi.fn().mockResolvedValue(tokens),
            });

            const response = await GET(makeRequest());

            expect(response.status).toBe(200);

            // Property: findByIdAndUpdate must be called once per token
            expect(mockInviteTokenFindByIdAndUpdate).toHaveBeenCalledTimes(tokens.length);

            // Property: each call must include expiringSoonEmailSentAt set to a Date
            for (const token of tokens) {
              expect(mockInviteTokenFindByIdAndUpdate).toHaveBeenCalledWith(
                token._id,
                { expiringSoonEmailSentAt: expect.any(Date) }
              );
            }

            // Property: processed count must equal the number of tokens
            const body = await response.json();
            expect(body.processed).toBe(tokens.length);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
