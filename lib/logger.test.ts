/**
 * Tests for lib/logger.ts
 *
 * Validates: Requirements 11.1, 11.2, 11.4, 11.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save and restore SENTRY_DSN around each test. */
function withSentryDsn(value: string | undefined, fn: () => void): void {
  const saved = process.env.SENTRY_DSN;
  if (value === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = value;
  }
  try {
    fn();
  } finally {
    if (saved === undefined) {
      delete process.env.SENTRY_DSN;
    } else {
      process.env.SENTRY_DSN = saved;
    }
  }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('logError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Structured log output
  // -------------------------------------------------------------------------

  describe('structured log output', () => {
    it('logs a structured object with context, message, and timestamp when SENTRY_DSN is absent', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[test context]', new Error('something went wrong'));
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
      const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(logged).toMatchObject({
        context: '[test context]',
        message: 'something went wrong',
      });
      expect(typeof logged.timestamp).toBe('string');
      // Timestamp should be a valid ISO 8601 string
      expect(() => new Date(logged.timestamp as string)).not.toThrow();
      expect(new Date(logged.timestamp as string).toISOString()).toBe(logged.timestamp);
    });

    it('extracts message from Error instances', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[ctx]', new Error('error message here'));
      });

      const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(logged.message).toBe('error message here');
    });

    it('converts non-Error values to string for message', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[ctx]', 'plain string error');
      });

      const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(logged.message).toBe('plain string error');
    });

    it('converts numeric error values to string', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[ctx]', 42);
      });

      const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(logged.message).toBe('42');
    });

    it('includes metadata in the log entry when provided', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[ctx]', new Error('oops'), { userId: 'u123', route: '/api/test' });
      });

      const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(logged.metadata).toEqual({ userId: 'u123', route: '/api/test' });
    });

    it('includes undefined metadata when not provided', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[ctx]', new Error('oops'));
      });

      const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(logged).toHaveProperty('metadata');
    });
  });

  // -------------------------------------------------------------------------
  // Does not throw
  // -------------------------------------------------------------------------

  describe('does not throw', () => {
    it('does not throw for a normal Error', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        expect(() => logError('[ctx]', new Error('test'))).not.toThrow();
      });
    });

    it('does not throw for null error value', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        expect(() => logError('[ctx]', null)).not.toThrow();
      });
    });

    it('does not throw for undefined error value', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        expect(() => logError('[ctx]', undefined)).not.toThrow();
      });
    });

    it('does not throw even when console.error itself throws', async () => {
      const { logError } = await import('./logger');

      consoleSpy.mockImplementation(() => {
        throw new Error('console.error exploded');
      });

      withSentryDsn(undefined, () => {
        expect(() => logError('[ctx]', new Error('original'))).not.toThrow();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Sentry integration
  // -------------------------------------------------------------------------

  describe('Sentry integration', () => {
    it('does not call console.error when SENTRY_DSN is set (Sentry path taken)', async () => {
      // Mock the dynamic import of @sentry/nextjs
      vi.doMock('@sentry/nextjs', () => ({
        captureException: vi.fn(),
      }));

      const { logError } = await import('./logger');

      withSentryDsn('https://abc@sentry.io/123', () => {
        logError('[ctx]', new Error('sentry error'));
      });

      // Give the dynamic import promise a tick to resolve
      await new Promise((r) => setTimeout(r, 0));

      // console.error should NOT have been called (Sentry handled it)
      expect(consoleSpy).not.toHaveBeenCalled();

      vi.doUnmock('@sentry/nextjs');
    });

    it('falls back to console.error when SENTRY_DSN is set but Sentry import fails', async () => {
      // Make the dynamic import reject
      vi.doMock('@sentry/nextjs', () => {
        throw new Error('Sentry not installed');
      });

      const { logError } = await import('./logger');

      withSentryDsn('https://abc@sentry.io/123', () => {
        logError('[ctx]', new Error('fallback error'));
      });

      // Give the dynamic import promise a tick to settle
      await new Promise((r) => setTimeout(r, 10));

      expect(consoleSpy).toHaveBeenCalled();

      vi.doUnmock('@sentry/nextjs');
    });

    it('falls back to console.error when SENTRY_DSN is absent', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        logError('[ctx]', new Error('no sentry'));
      });

      expect(consoleSpy).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Property 20: logError always produces a structured log with required fields
  // Feature: security-hardening, Property 20: logError always produces a structured log with required fields
  // Validates: Requirements 11.2, 11.5
  // -------------------------------------------------------------------------

  describe('Property 20: logError always produces a structured log with required fields', () => {
    it('for any context, error, and metadata — log entry contains context, message, timestamp and does not throw', async () => {
      const { logError } = await import('./logger');

      withSentryDsn(undefined, () => {
        fc.assert(
          fc.property(
            fc.string(),                          // context
            fc.oneof(                             // error value
              fc.string(),
              fc.integer(),
              fc.boolean(),
              fc.constant(null),
              fc.constant(undefined),
              fc.string().map((msg) => new Error(msg))
            ),
            fc.option(                            // optional metadata
              fc.dictionary(fc.string(), fc.anything()),
              { nil: undefined }
            ),
            (context, error, metadata) => {
              consoleSpy.mockClear();

              // Must not throw
              expect(() =>
                logError(context, error, metadata as Record<string, unknown> | undefined)
              ).not.toThrow();

              // Must have logged exactly once
              expect(consoleSpy).toHaveBeenCalledOnce();

              const logged = consoleSpy.mock.calls[0][0] as Record<string, unknown>;

              // Required fields must be present
              expect(logged).toHaveProperty('context', context);
              expect(logged).toHaveProperty('message');
              expect(typeof logged.message).toBe('string');
              expect(logged).toHaveProperty('timestamp');
              expect(typeof logged.timestamp).toBe('string');

              // Timestamp must be a valid ISO string
              const ts = new Date(logged.timestamp as string);
              expect(isNaN(ts.getTime())).toBe(false);

              return true;
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
