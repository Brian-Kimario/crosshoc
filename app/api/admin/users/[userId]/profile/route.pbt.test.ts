/**
 * Property-Based Tests for PATCH /api/admin/users/[userId]/profile
 *
 * Feature: admin-enhanced-controls, Property 9: Profile update applies valid fields
 * Validates: Requirements 6.1
 *
 * Feature: admin-enhanced-controls, Property 10: Invalid email format is always rejected
 * Validates: Requirements 6.5
 *
 * Feature: admin-enhanced-controls, Property 11: Password is never modified by profile-update endpoint
 * Validates: Requirements 6.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
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

vi.mock('@/lib/models/User', () => ({
  default: {
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
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

import { PATCH } from './route';
import { requireAdmin } from '@/lib/admin-auth';
import User from '@/lib/models/User';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_USER_ID = 'admin-user-id-abc';
const ADMIN_NAME = 'Admin User';
const TARGET_USER_ID = 'target-user-id-xyz';
const ORIGINAL_PASSWORD_HASH = '$2b$10$originalHashThatShouldNeverChange';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock user document (without password — as returned by .select("-password")) */
function makeMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => TARGET_USER_ID },
    name: 'Original Name',
    email: 'original@example.com',
    ...overrides,
  };
}

/** Build a mock user document that includes the password field */
function makeMockUserWithPassword(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => TARGET_USER_ID },
    name: 'Original Name',
    email: 'original@example.com',
    password: ORIGINAL_PASSWORD_HASH,
    ...overrides,
  };
}

/** Build a NextRequest for PATCH with the given body */
function makeRequest(body: unknown, userId = TARGET_USER_ID): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/users/${userId}/profile`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/** Build the params object expected by the route handler */
function makeParams(userId = TARGET_USER_ID) {
  return { params: Promise.resolve({ userId }) };
}

/** Set up admin auth mock */
function mockAdminAuth() {
  (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: { userId: ADMIN_USER_ID, name: ADMIN_NAME },
    error: null,
  });
}

/**
 * Set up User mocks for a successful update.
 * findById (first call) → user without password
 * findOne → null (no duplicate email)
 * findByIdAndUpdate → resolves
 * findById (second call, for response) → updated user
 */
function setupSuccessUserMocks(
  originalUser: Record<string, unknown>,
  updatedUser: Record<string, unknown>
) {
  let findByIdCallCount = 0;
  (User.findById as ReturnType<typeof vi.fn>).mockImplementation(() => {
    findByIdCallCount++;
    if (findByIdCallCount === 1) {
      // First call: fetch user (exclude password)
      return {
        select: vi.fn().mockResolvedValue(originalUser),
      };
    }
    // Second call: fetch updated user for response
    return {
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(updatedUser),
      }),
    };
  });
  (User.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  });
  (User.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Property 9: Profile update applies valid fields
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/users/[userId]/profile — Property 9: Profile update applies valid fields', () => {
  // Feature: admin-enhanced-controls, Property 9: Profile update applies valid fields
  // Validates: Requirements 6.1

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth();
  });

  it(
    'applies a valid name update and reflects it in the response for any non-empty name',
    async () => {
      // Feature: admin-enhanced-controls, Property 9: Profile update applies valid fields
      // Validates: Requirements 6.1
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          async (name) => {
            vi.clearAllMocks();
            mockAdminAuth();

            const originalUser = makeMockUser();
            const updatedUser = { ...originalUser, name: name.trim() };

            setupSuccessUserMocks(originalUser, updatedUser);

            const req = makeRequest({ name });
            const res = await PATCH(req, makeParams());
            const body = await res.json();

            // Assert: request succeeded
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);

            // Assert: the response reflects the new name
            expect(body.user.name).toBe(name.trim());

            // Assert: findByIdAndUpdate was called with the new name
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
              TARGET_USER_ID,
              expect.objectContaining({ $set: expect.objectContaining({ name: name.trim() }) })
            );
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'applies a valid email update and reflects it in the response for any valid email',
    async () => {
      // Feature: admin-enhanced-controls, Property 9: Profile update applies valid fields
      // Validates: Requirements 6.1
      await fc.assert(
        fc.asyncProperty(
          // Generate valid emails: localPart@domain.tld
          fc.record({
            local: fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
            domain: fc.stringMatching(/^[a-z]{2,8}$/),
            tld: fc.stringMatching(/^[a-z]{2,4}$/),
          }),
          async ({ local, domain, tld }) => {
            vi.clearAllMocks();
            mockAdminAuth();

            const email = `${local}@${domain}.${tld}`;
            const originalUser = makeMockUser();
            const updatedUser = { ...originalUser, email };

            setupSuccessUserMocks(originalUser, updatedUser);

            const req = makeRequest({ email });
            const res = await PATCH(req, makeParams());
            const body = await res.json();

            // Assert: request succeeded
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);

            // Assert: the response reflects the new email
            expect(body.user.email).toBe(email);

            // Assert: findByIdAndUpdate was called with the new email
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
              TARGET_USER_ID,
              expect.objectContaining({ $set: expect.objectContaining({ email }) })
            );
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 10: Invalid email format is always rejected
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/users/[userId]/profile — Property 10: Invalid email format is always rejected', () => {
  // Feature: admin-enhanced-controls, Property 10: Invalid email format is always rejected
  // Validates: Requirements 6.5

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth();
  });

  it(
    'returns 400 and does not modify the user for any string that is not a valid email',
    async () => {
      // Feature: admin-enhanced-controls, Property 10: Invalid email format is always rejected
      // Validates: Requirements 6.5
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      await fc.assert(
        fc.asyncProperty(
          // Generate strings that do NOT match the email regex
          fc.oneof(
            fc.constant(''),
            fc.constant('notanemail'),
            fc.constant('@nodomain'),
            fc.constant('missing@tld'),
            fc.constant('spaces in@email.com'),
            fc.constant('double@@at.com'),
            fc.string().filter((s) => !EMAIL_REGEX.test(s) && s.length > 0),
          ),
          async (invalidEmail) => {
            vi.clearAllMocks();
            mockAdminAuth();

            const req = makeRequest({ email: invalidEmail });
            const res = await PATCH(req, makeParams());
            const body = await res.json();

            // Assert: request rejected with 400
            expect(res.status).toBe(400);
            expect(body).toEqual({ error: 'Invalid email format' });

            // Assert: user document was never modified
            expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 11: Password is never modified by profile-update endpoint
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/users/[userId]/profile — Property 11: Password is never modified', () => {
  // Feature: admin-enhanced-controls, Property 11: Password is never modified by profile-update endpoint
  // Validates: Requirements 6.9

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth();
  });

  it(
    'never passes a password field to findByIdAndUpdate regardless of what is in the request body',
    async () => {
      // Feature: admin-enhanced-controls, Property 11: Password is never modified
      // Validates: Requirements 6.9
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary request bodies that may include a password field
          fc.record({
            name: fc.option(fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0), { nil: undefined }),
            password: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
          }),
          async ({ name, password }) => {
            vi.clearAllMocks();
            mockAdminAuth();

            // Only proceed if name is provided (otherwise 400 for no fields)
            if (!name) return;

            const originalUser = makeMockUserWithPassword();
            const updatedUser = { ...originalUser, name: name.trim() };

            setupSuccessUserMocks(originalUser, updatedUser);

            // Build request body — may include a password field
            const requestBody: Record<string, unknown> = { name };
            if (password !== undefined) requestBody.password = password;

            const req = makeRequest(requestBody);
            const res = await PATCH(req, makeParams());

            // If the request succeeded, verify password was not touched
            if (res.status === 200) {
              const updateCalls = (User.findByIdAndUpdate as ReturnType<typeof vi.fn>).mock.calls;
              for (const call of updateCalls) {
                const updateArg = call[1] as Record<string, unknown>;
                const setArg = (updateArg.$set ?? {}) as Record<string, unknown>;

                // Assert: password field must never appear in the $set update
                expect(setArg).not.toHaveProperty('password');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
