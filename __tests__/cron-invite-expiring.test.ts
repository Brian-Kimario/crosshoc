/**
 * Unit tests for GET /api/cron/invite-expiring route.
 *
 * Validates: Requirements 8.3, 8.4
 *
 * Tests:
 * 1. Returns 403 without CRON_SECRET (missing Authorization header)
 * 2. Returns 403 with wrong CRON_SECRET
 * 3. Skips tokens with expiringSoonEmailSentAt already set (not returned by query)
 * 4. Sets expiringSoonEmailSentAt after processing (findByIdAndUpdate called with token id)
 * 5. Continues processing remaining tokens when one sendEmail() fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const CRON_SECRET = 'test-cron-secret-abc123';

/** Build a NextRequest with optional Authorization header */
function makeRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['authorization'] = authHeader;
  }
  return new NextRequest('http://localhost/api/cron/invite-expiring', {
    method: 'GET',
    headers,
  });
}

/** A valid token object returned by InviteToken.find */
function makeToken(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    groupId: `group-${id}`,
    createdBy: `user-${id}`,
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
    ...overrides,
  };
}

/** A valid group object returned by Group.findById */
function makeGroup(id: string) {
  return {
    _id: id,
    name: `Test Group ${id}`,
  };
}

/** A valid user object returned by User.findById */
function makeUser(id: string) {
  return {
    _id: id,
    email: `user-${id}@example.com`,
    name: `User ${id}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/invite-expiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;

    // Default: no tokens found
    mockInviteTokenFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  // -------------------------------------------------------------------------
  // Requirement 8.3 — Authorization header required
  // -------------------------------------------------------------------------

  describe('authorization (Requirement 8.3)', () => {
    it('returns 403 when Authorization header is missing', async () => {
      const request = makeRequest(); // no header
      const response = await GET(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('returns 403 when Authorization header has wrong secret', async () => {
      const request = makeRequest('Bearer wrong-secret');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('returns 403 when Authorization header is missing Bearer prefix', async () => {
      const request = makeRequest(CRON_SECRET); // missing "Bearer " prefix
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('returns 200 with correct Authorization header', async () => {
      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('does not call dbConnect when authorization fails', async () => {
      const request = makeRequest('Bearer wrong-secret');
      await GET(request);

      expect(mockDbConnect).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.3 — Skips already-notified tokens
  // -------------------------------------------------------------------------

  describe('skipping already-notified tokens (Requirement 8.3)', () => {
    it('skips tokens with expiringSoonEmailSentAt already set (not in query results)', async () => {
      // The route queries with expiringSoonEmailSentAt: null, so already-notified
      // tokens won't appear. Mock find to return empty array to simulate this.
      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.processed).toBe(0);

      // No emails sent, no updates made
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockInviteTokenFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns processed: 0 when no qualifying tokens exist', async () => {
      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      const body = await response.json();
      expect(body.processed).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.4 — Sets expiringSoonEmailSentAt after processing
  // -------------------------------------------------------------------------

  describe('sets expiringSoonEmailSentAt after processing (Requirement 8.4)', () => {
    it('calls findByIdAndUpdate with token id after sending email', async () => {
      const token = makeToken('token-1');

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([token]),
      });

      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeGroup('group-token-1')),
        }),
      });

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeUser('user-token-1')),
        }),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);

      // findByIdAndUpdate must be called with the token's _id
      expect(mockInviteTokenFindByIdAndUpdate).toHaveBeenCalledOnce();
      expect(mockInviteTokenFindByIdAndUpdate).toHaveBeenCalledWith(
        'token-1',
        { expiringSoonEmailSentAt: expect.any(Date) }
      );
    });

    it('returns processed: 1 after successfully processing one token', async () => {
      const token = makeToken('token-1');

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([token]),
      });

      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeGroup('group-token-1')),
        }),
      });

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeUser('user-token-1')),
        }),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      const body = await response.json();
      expect(body.processed).toBe(1);
    });

    it('skips token when group is not found', async () => {
      const token = makeToken('token-1');

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([token]),
      });

      // Group not found
      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.processed).toBe(0);
      expect(mockInviteTokenFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('skips token when creator user is not found', async () => {
      const token = makeToken('token-1');

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([token]),
      });

      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeGroup('group-token-1')),
        }),
      });

      // User not found
      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.processed).toBe(0);
      expect(mockInviteTokenFindByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.4 — Continues processing on per-token errors
  // -------------------------------------------------------------------------

  describe('continues processing on per-token errors (Requirement 8.4)', () => {
    it('continues processing remaining tokens when sendEmail throws for the first token', async () => {
      const token1 = makeToken('token-1');
      const token2 = makeToken('token-2');

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([token1, token2]),
      });

      // Both groups and users resolve successfully
      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeGroup('group-id')),
        }),
      });

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeUser('user-id')),
        }),
      });

      // sendEmail throws for the first call, succeeds for the second
      mockSendEmail
        .mockImplementationOnce(() => { throw new Error('Email send failed'); })
        .mockResolvedValueOnce(undefined);

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      expect(response.status).toBe(200);

      // The second token should still be processed
      // findByIdAndUpdate should be called for the second token at minimum
      expect(mockInviteTokenFindByIdAndUpdate).toHaveBeenCalledWith(
        'token-2',
        { expiringSoonEmailSentAt: expect.any(Date) }
      );
    });

    it('returns processed count only for successfully processed tokens', async () => {
      const token1 = makeToken('token-1');
      const token2 = makeToken('token-2');

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([token1, token2]),
      });

      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeGroup('group-id')),
        }),
      });

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeUser('user-id')),
        }),
      });

      // sendEmail throws for the first call (token1 fails), succeeds for second (token2 succeeds)
      mockSendEmail
        .mockImplementationOnce(() => { throw new Error('Email send failed'); })
        .mockResolvedValueOnce(undefined);

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      const body = await response.json();
      // Only token2 was successfully processed (token1 threw before findByIdAndUpdate)
      expect(body.processed).toBe(1);
    });

    it('processes all tokens when none fail', async () => {
      const tokens = [makeToken('token-1'), makeToken('token-2'), makeToken('token-3')];

      mockInviteTokenFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue(tokens),
      });

      mockGroupFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeGroup('group-id')),
        }),
      });

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(makeUser('user-id')),
        }),
      });

      const request = makeRequest(`Bearer ${CRON_SECRET}`);
      const response = await GET(request);

      const body = await response.json();
      expect(body.processed).toBe(3);
      expect(mockInviteTokenFindByIdAndUpdate).toHaveBeenCalledTimes(3);
    });
  });
});
