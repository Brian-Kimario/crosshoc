/**
 * Property-based tests for lib/email.ts
 *
 * Feature: transactional-email, Property 1: sendEmail() never throws
 *
 * Validates: Requirements 1.2, 1.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted runs before vi.mock factories
// ---------------------------------------------------------------------------

const { mockEmailsSend, MockResend } = vi.hoisted(() => {
  const mockEmailsSend = vi.fn();

  // Resend is used as `new Resend(apiKey)` — must be a proper constructor
  function MockResend(_apiKey: string) {
    return { emails: { send: mockEmailsSend } };
  }

  return { mockEmailsSend, MockResend };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// server-only throws in test environments; mock it as a no-op
vi.mock('server-only', () => ({}));

// Mock the Resend package so we never make real network calls
vi.mock('resend', () => ({ Resend: MockResend }));

// Mock User model for emailPrefs tests
const mockUserFindById = vi.fn();
vi.mock('@/lib/models/User', () => ({
  default: {
    findById: mockUserFindById,
  },
}));

// Mock db connect
const mockDbConnect = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/db', () => ({
  default: mockDbConnect,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { sendEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Property 1: sendEmail() never throws
// ---------------------------------------------------------------------------

describe('Property 1: sendEmail() never throws', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: User.findById returns a user with all prefs enabled
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ emailPrefs: {} }),
      }),
    });
    // Set a real-looking API key so the send path is exercised
    process.env.RESEND_API_KEY = 're_test_ABCdef123456_realLookingKey';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it(
    'always resolves regardless of Resend throwing or succeeding',
    async () => {
      // Feature: transactional-email, Property 1: sendEmail() never throws
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            to: fc.emailAddress(),
            subject: fc.string(),
            react: fc.constant({ type: 'div', props: {}, key: null }),
          }),
          fc.boolean(), // whether Resend should throw
          async (params, shouldThrow) => {
            // Configure Resend mock to randomly throw or succeed
            if (shouldThrow) {
              mockEmailsSend.mockRejectedValueOnce(
                new Error('Simulated Resend API failure')
              );
            } else {
              mockEmailsSend.mockResolvedValueOnce({
                data: { id: 'email-id-123' },
                error: null,
              });
            }

            // Property: sendEmail() must always resolve, never throw or reject
            await expect(
              sendEmail(params as Parameters<typeof sendEmail>[0])
            ).resolves.toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 2: sendEmail() is a no-op when RESEND_API_KEY is absent or placeholder
// ---------------------------------------------------------------------------

/**
 * Feature: transactional-email, Property 2: sendEmail() is a no-op when RESEND_API_KEY is absent or placeholder
 *
 * Validates: Requirements 1.4, 10.1
 */
describe('Property 2: sendEmail() is a no-op when RESEND_API_KEY is absent or placeholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it(
    'never calls Resend when RESEND_API_KEY is absent or set to re_placeholder',
    async () => {
      // Feature: transactional-email, Property 2: sendEmail() is a no-op when RESEND_API_KEY is absent or placeholder
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            to: fc.emailAddress(),
            subject: fc.string(),
          }),
          fc.oneof(fc.constant(undefined), fc.constant('re_placeholder')),
          async (params, apiKey) => {
            // Set or unset RESEND_API_KEY based on the generated value
            if (apiKey === undefined) {
              delete process.env.RESEND_API_KEY;
            } else {
              process.env.RESEND_API_KEY = apiKey;
            }

            vi.clearAllMocks();

            // Property: sendEmail() must not make any network call to Resend
            await sendEmail({
              ...params,
              react: { type: 'div', props: {}, key: null } as unknown as Parameters<typeof sendEmail>[0]['react'],
            });

            // Assert the emails.send method was never called (no network call made)
            expect(mockEmailsSend).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 6: sendEmail() respects opt-out emailPrefs
// ---------------------------------------------------------------------------

/**
 * Feature: transactional-email, Property 6: sendEmail() respects opt-out emailPrefs
 *
 * Validates: Requirements 9.2
 */
describe('Property 6: sendEmail() respects opt-out emailPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set a real-looking API key so the send path would be exercised if prefs check fails
    process.env.RESEND_API_KEY = 're_test_ABCdef123456_realLookingKey';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it(
    'never calls Resend when the user has opted out of the relevant email type',
    async () => {
      // Feature: transactional-email, Property 6: sendEmail() respects opt-out emailPrefs
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            prefsKey: fc.constantFrom(
              'newLogin',
              'groupInvite',
              'inviteExpiringSoon',
              'expenseVoided',
              'settlementVoided',
              'removedFromGroup',
              'groupDeleted'
            ),
            userId: fc.string({ minLength: 1 }),
          }),
          async ({ prefsKey, userId }) => {
            vi.clearAllMocks();

            // Mock User.findById to return emailPrefs with the tested key set to false
            mockUserFindById.mockReturnValue({
              select: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                  emailPrefs: { [prefsKey]: false },
                }),
              }),
            });

            await sendEmail({
              to: 'test@example.com',
              subject: 'Test subject',
              react: { type: 'div', props: {}, key: null } as unknown as Parameters<typeof sendEmail>[0]['react'],
              userId,
              prefsKey: prefsKey as Parameters<typeof sendEmail>[0]['prefsKey'],
            });

            // Property: Resend must never be called when the user has opted out
            expect(mockEmailsSend).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 7: Security-critical emails bypass emailPrefs
// ---------------------------------------------------------------------------

/**
 * Feature: transactional-email, Property 7: Security-critical emails are always sent regardless of emailPrefs
 *
 * Validates: Requirements 9.3
 */
describe('Property 7: Security-critical emails bypass emailPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set a real-looking API key so the send path is exercised
    process.env.RESEND_API_KEY = 're_test_ABCdef123456_realLookingKey';

    // Mock User with all emailPrefs set to false — should NOT be consulted
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          emailPrefs: {
            newLogin: false,
            groupInvite: false,
            inviteExpiringSoon: false,
            expenseVoided: false,
            settlementVoided: false,
            removedFromGroup: false,
            groupDeleted: false,
          },
        }),
      }),
    });

    // Default: Resend send succeeds
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it(
    'always calls Resend when sendEmail() is called without userId/prefsKey (security-critical pattern)',
    async () => {
      // Feature: transactional-email, Property 7: Security-critical emails are always sent regardless of emailPrefs
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            to: fc.emailAddress(),
            subject: fc.string(),
          }),
          async (params) => {
            vi.clearAllMocks();
            mockEmailsSend.mockResolvedValue({ data: { id: 'email-id-123' }, error: null });

            // Call sendEmail() WITHOUT userId/prefsKey — security-critical pattern
            await sendEmail({
              ...params,
              react: { type: 'div', props: {}, key: null } as unknown as Parameters<typeof sendEmail>[0]['react'],
              // No userId, no prefsKey — bypasses emailPrefs check entirely
            });

            // Property: Resend must always be called regardless of any emailPrefs state
            expect(mockEmailsSend).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
