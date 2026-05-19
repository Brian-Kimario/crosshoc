/**
 * Tests for lib/env-check.ts
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { validateEnv } from './env-check';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_VARS = ['MONGODB_URI', 'JWT_SECRET', 'NEXTAUTH_URL'] as const;
const OPTIONAL_REDIS_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;
const ALL_VARS = [...REQUIRED_VARS, ...OPTIONAL_REDIS_VARS, 'DB_CONNECTION_STRING'] as const;

/** Save and clear all relevant env vars; returns a restore function. */
function clearEnvVars(): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const name of ALL_VARS) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

/** Set all required vars to non-empty values. */
function setAllRequired(): void {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  process.env.JWT_SECRET = 'supersecretjwt';
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
}

/** Set all optional Redis vars. */
function setAllOptional(): void {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token123';
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('validateEnv', () => {
  let restore: () => void;
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedNodeEnv = process.env.NODE_ENV;
    restore = clearEnvVars();
  });

  afterEach(() => {
    restore();
    // Restore NODE_ENV using vi.stubEnv (direct assignment is read-only in TS)
    vi.stubEnv('NODE_ENV', savedNodeEnv ?? 'test');
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // development / test — should throw
  // -------------------------------------------------------------------------

  describe('in development/test mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'test');
    });

    it('throws when all required vars are missing', () => {
      expect(() => validateEnv()).toThrow();
    });

    it('throws with a message listing all missing required variable names', () => {
      let error: Error | null = null;
      try {
        validateEnv();
      } catch (e) {
        error = e as Error;
      }
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/MONGODB_URI/);
      expect(error!.message).toMatch(/JWT_SECRET/);
      expect(error!.message).toMatch(/NEXTAUTH_URL/);
    });

    it('throws when only some required vars are missing', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      expect(() => validateEnv()).toThrow(/JWT_SECRET/);
    });

    it('throws when a required var is set to an empty string', () => {
      setAllRequired();
      process.env.JWT_SECRET = '';
      expect(() => validateEnv()).toThrow(/JWT_SECRET/);
    });

    it('throws when a required var is set to whitespace only', () => {
      setAllRequired();
      process.env.JWT_SECRET = '   ';
      expect(() => validateEnv()).toThrow(/JWT_SECRET/);
    });

    it('does not throw when all required vars are present', () => {
      setAllRequired();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => validateEnv()).not.toThrow();
    });

    it('accepts DB_CONNECTION_STRING as an alternative to MONGODB_URI', () => {
      process.env.DB_CONNECTION_STRING = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'supersecretjwt';
      process.env.NEXTAUTH_URL = 'http://localhost:3000';
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => validateEnv()).not.toThrow();
    });

    it('does not throw for missing optional Redis vars', () => {
      setAllRequired();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => validateEnv()).not.toThrow();
    });

    it('warns (console.warn) when optional Redis vars are missing', () => {
      setAllRequired();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateEnv();
      expect(warnSpy).toHaveBeenCalled();
      const warnMessage = warnSpy.mock.calls[0][0] as string;
      expect(warnMessage).toMatch(/UPSTASH_REDIS_REST_URL/);
      expect(warnMessage).toMatch(/UPSTASH_REDIS_REST_TOKEN/);
    });

    it('does not warn about Redis vars when they are present', () => {
      setAllRequired();
      setAllOptional();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateEnv();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not call console.error in dev/test mode (throws instead)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        validateEnv();
      } catch {
        // expected
      }
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // production — should log, not throw
  // -------------------------------------------------------------------------

  describe('in production mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('does not throw when required vars are missing', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => validateEnv()).not.toThrow();
    });

    it('calls console.error listing missing variable names', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateEnv();
      expect(errorSpy).toHaveBeenCalled();
      const errorMessage = errorSpy.mock.calls[0][0] as string;
      expect(errorMessage).toMatch(/MONGODB_URI/);
      expect(errorMessage).toMatch(/JWT_SECRET/);
      expect(errorMessage).toMatch(/NEXTAUTH_URL/);
    });

    it('does not call console.error when all required vars are present', () => {
      setAllRequired();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateEnv();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('warns about missing optional Redis vars in production too', () => {
      setAllRequired();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      validateEnv();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Property-based test
  // Property 18: validateEnv lists all missing variables in the thrown error
  // Feature: security-hardening, Property 18: validateEnv lists all missing variables in the thrown error
  // Validates: Requirements 9.2
  // -------------------------------------------------------------------------

  describe('Property 18: validateEnv lists all missing variables in the thrown error', () => {
    it('thrown error message contains every missing required variable name', () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const requiredNames = ['MONGODB_URI', 'JWT_SECRET', 'NEXTAUTH_URL'] as const;

      fc.assert(
        fc.property(
          // Generate a non-empty subset of required vars to omit
          fc.subarray([...requiredNames], { minLength: 1 }),
          (toOmit) => {
            // Set all required vars first
            setAllRequired();
            // Then remove the chosen subset
            for (const name of toOmit) {
              delete process.env[name];
              // Also clear the DB alternative if we're omitting MONGODB_URI
              if (name === 'MONGODB_URI') {
                delete process.env['DB_CONNECTION_STRING'];
              }
            }

            let thrownError: Error | null = null;
            try {
              validateEnv();
            } catch (e) {
              thrownError = e as Error;
            }

            if (!thrownError) return false;

            // Every omitted variable name must appear in the error message
            return toOmit.every((name) => thrownError!.message.includes(name));
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
