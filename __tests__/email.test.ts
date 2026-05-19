/**
 * Unit tests for lib/email.ts
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 9.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted runs before vi.mock factories, so these refs
// are available inside the factory closures.
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
// Module mocks — must be declared before any imports that trigger them
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
// Helpers
// ---------------------------------------------------------------------------

// A minimal mock ReactElement — avoids needing JSX transform in vitest
const mockReactElement = { type: 'div', props: { children: 'Hello' }, key: null } as unknown as ReactElement;

const baseParams = {
  to: 'user@example.com',
  subject: 'Test Subject',
  react: mockReactElement,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendEmail()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Resend send succeeds
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    // Default: User.findById returns a user with all prefs enabled (default true)
    mockUserFindById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ emailPrefs: {} }),
      }),
    });
  });

  afterEach(() => {
    // Restore any env vars that were modified
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  // -------------------------------------------------------------------------
  // Requirement 1.4 — No-op when RESEND_API_KEY is absent
  // -------------------------------------------------------------------------

  describe('no-op when RESEND_API_KEY is absent', () => {
    it('does not call Resend when RESEND_API_KEY is undefined', async () => {
      delete process.env.RESEND_API_KEY;

      await sendEmail(baseParams);

      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it('resolves without throwing when RESEND_API_KEY is undefined', async () => {
      delete process.env.RESEND_API_KEY;

      await expect(sendEmail(baseParams)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 10.1 — No-op when RESEND_API_KEY is "re_placeholder"
  // -------------------------------------------------------------------------

  describe('no-op when RESEND_API_KEY is "re_placeholder"', () => {
    it('does not call Resend when RESEND_API_KEY is the placeholder value', async () => {
      process.env.RESEND_API_KEY = 're_placeholder';

      await sendEmail(baseParams);

      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it('resolves without throwing when RESEND_API_KEY is "re_placeholder"', async () => {
      process.env.RESEND_API_KEY = 're_placeholder';

      await expect(sendEmail(baseParams)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.5 — from address selection
  // -------------------------------------------------------------------------

  describe('from address', () => {
    it('uses EMAIL_FROM env var when set', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';
      process.env.EMAIL_FROM = 'MyApp <hello@myapp.com>';

      await sendEmail(baseParams);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'MyApp <hello@myapp.com>' })
      );
    });

    it('falls back to default from address when EMAIL_FROM is absent', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';
      delete process.env.EMAIL_FROM;

      await sendEmail(baseParams);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'SplitEasy <noreply@spliteasy.app>' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 9.2 — emailPrefs opt-out skips Resend call
  // -------------------------------------------------------------------------

  describe('emailPrefs opt-out', () => {
    it('skips Resend call when user has opted out of the email type', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      // User has opted out of newLogin emails
      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            emailPrefs: { newLogin: false },
          }),
        }),
      });

      await sendEmail({
        ...baseParams,
        userId: 'user-id-123',
        prefsKey: 'newLogin',
      });

      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it('sends email when user has the pref set to true', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            emailPrefs: { newLogin: true },
          }),
        }),
      });

      await sendEmail({
        ...baseParams,
        userId: 'user-id-123',
        prefsKey: 'newLogin',
      });

      expect(mockEmailsSend).toHaveBeenCalledOnce();
    });

    it('sends email when user emailPrefs does not include the key (default allow)', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      // emailPrefs exists but does not have the key — should default to sending
      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            emailPrefs: {},
          }),
        }),
      });

      await sendEmail({
        ...baseParams,
        userId: 'user-id-123',
        prefsKey: 'groupInvite',
      });

      expect(mockEmailsSend).toHaveBeenCalledOnce();
    });

    it('skips prefs check and sends when userId is not provided', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      // No userId — security-critical email pattern, prefs check is bypassed
      await sendEmail(baseParams);

      expect(mockUserFindById).not.toHaveBeenCalled();
      expect(mockEmailsSend).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.3 — emailPrefs fail-open: DB error still sends email
  // -------------------------------------------------------------------------

  describe('emailPrefs fail-open on DB error', () => {
    it('still sends email when User.findById throws', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        }),
      });

      await sendEmail({
        ...baseParams,
        userId: 'user-id-123',
        prefsKey: 'expenseVoided',
      });

      // Fail open — email should still be sent despite DB error
      expect(mockEmailsSend).toHaveBeenCalledOnce();
    });

    it('still sends email when dbConnect throws', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      mockDbConnect.mockRejectedValueOnce(new Error('Cannot connect to DB'));

      await sendEmail({
        ...baseParams,
        userId: 'user-id-123',
        prefsKey: 'settlementVoided',
      });

      // Fail open — email should still be sent despite DB error
      expect(mockEmailsSend).toHaveBeenCalledOnce();
    });

    it('resolves without throwing when DB error occurs', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      mockUserFindById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockRejectedValue(new Error('Timeout')),
        }),
      });

      await expect(
        sendEmail({
          ...baseParams,
          userId: 'user-id-123',
          prefsKey: 'groupDeleted',
        })
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.2 / 1.3 — Resend API error is caught and does not throw
  // -------------------------------------------------------------------------

  describe('Resend API error handling', () => {
    it('does not throw when Resend.emails.send rejects', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      mockEmailsSend.mockRejectedValue(new Error('Resend API unavailable'));

      await expect(sendEmail(baseParams)).resolves.toBeUndefined();
    });

    it('does not throw when Resend.emails.send throws synchronously', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      mockEmailsSend.mockImplementation(() => {
        throw new Error('Unexpected sync error');
      });

      await expect(sendEmail(baseParams)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // General — correct params forwarded to Resend
  // -------------------------------------------------------------------------

  describe('correct params forwarded to Resend', () => {
    it('passes to, subject, and react to resend.emails.send', async () => {
      process.env.RESEND_API_KEY = 're_test_key_123';

      const params = {
        to: 'recipient@example.com',
        subject: 'Welcome to SplitEasy',
        react: mockReactElement,
      };

      await sendEmail(params);

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Welcome to SplitEasy',
          react: mockReactElement,
        })
      );
    });
  });
});
