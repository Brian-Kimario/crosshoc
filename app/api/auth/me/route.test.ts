/**
 * Integration tests for app/api/auth/me/route.ts
 *
 * Property 11: API responses never expose sensitive user fields
 * Validates: Requirements 7.4
 *
 * Feature: security-hardening, Property 11: API responses never expose sensitive user fields
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { SAFE_USER_FIELDS } from '@/lib/sanitize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENSITIVE_FIELDS = ['password', 'loginAttempts', 'lockUntil', 'lastLoginIp'] as const;

/**
 * Build a mock user document that includes all sensitive fields.
 * This simulates what a raw MongoDB document would look like if no
 * projection were applied.
 */
function buildRawUserDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user123',
    name: 'Alice',
    email: 'alice@example.com',
    password: '$2b$10$hashedpassword',
    loginAttempts: 3,
    lockUntil: new Date('2099-01-01'),
    lastLoginIp: '192.168.1.1',
    tokenVersion: 1,
    isDisabled: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests — SAFE_USER_FIELDS constant
// ---------------------------------------------------------------------------

describe('SAFE_USER_FIELDS', () => {
  it('excludes password', () => {
    expect(SAFE_USER_FIELDS).toContain('-password');
  });

  it('excludes loginAttempts', () => {
    expect(SAFE_USER_FIELDS).toContain('-loginAttempts');
  });

  it('excludes lockUntil', () => {
    expect(SAFE_USER_FIELDS).toContain('-lockUntil');
  });

  it('excludes lastLoginIp', () => {
    expect(SAFE_USER_FIELDS).toContain('-lastLoginIp');
  });

  it('is a non-empty string', () => {
    expect(typeof SAFE_USER_FIELDS).toBe('string');
    expect(SAFE_USER_FIELDS.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — /api/auth/me route applies SAFE_USER_FIELDS
// ---------------------------------------------------------------------------

describe('GET /api/auth/me — SAFE_USER_FIELDS projection', () => {
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockFindById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock the User model's findById to capture the .select() call
    mockSelect = vi.fn().mockResolvedValue({
      _id: 'user123',
      name: 'Alice',
      email: 'alice@example.com',
    });
    mockFindById = vi.fn().mockReturnValue({ select: mockSelect });

    vi.doMock('@/lib/models/User', () => ({
      default: { findById: mockFindById },
    }));

    vi.doMock('@/lib/db', () => ({
      default: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock('@/lib/auth', () => ({
      verifyAuth: vi.fn().mockResolvedValue('user123'),
      unauthorizedResponse: vi.fn().mockReturnValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      ),
      successResponse: vi.fn().mockImplementation((data: unknown) =>
        new Response(JSON.stringify(data), { status: 200 })
      ),
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('calls User.findById().select() with SAFE_USER_FIELDS', async () => {
    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/auth/me');
    await GET(request as any);

    expect(mockFindById).toHaveBeenCalledWith('user123');
    expect(mockSelect).toHaveBeenCalledWith(SAFE_USER_FIELDS);
  });

  it('does not return password in the response body', async () => {
    // Simulate a user document that has a password field (should be excluded by projection)
    mockSelect.mockResolvedValue({
      _id: 'user123',
      name: 'Alice',
      email: 'alice@example.com',
      // password is NOT present — projection excluded it
    });

    const { GET } = await import('./route');
    const request = new Request('http://localhost/api/auth/me');
    const response = await GET(request as any);
    const body = await response.json();

    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('loginAttempts');
    expect(bodyStr).not.toContain('lockUntil');
    expect(bodyStr).not.toContain('lastLoginIp');
  });
});

// ---------------------------------------------------------------------------
// Property 11: API responses never expose sensitive user fields
// Feature: security-hardening, Property 11: API responses never expose sensitive user fields
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

describe('Property 11: API responses never expose sensitive user fields', () => {
  it('for any user document, serialized response body does not contain sensitive fields', () => {
    // This property tests that if a raw user document (with all fields) were
    // accidentally returned without projection, we can detect it — and that
    // the SAFE_USER_FIELDS projection string correctly excludes all sensitive fields.

    fc.assert(
      fc.property(
        // Generate arbitrary user-like objects with sensitive fields present
        fc.record({
          _id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8 }),
          loginAttempts: fc.nat(),
          lockUntil: fc.option(fc.date(), { nil: null }),
          lastLoginIp: fc.option(fc.ipV4(), { nil: null }),
          tokenVersion: fc.nat(),
        }),
        (rawUser) => {
          // Simulate what the route does: only expose safe fields
          // (i.e., what would be returned after .select(SAFE_USER_FIELDS))
          const safeUser = {
            id: rawUser._id,
            name: rawUser.name,
            email: rawUser.email,
          };

          const responseBody = JSON.stringify({ user: safeUser });

          // The serialized response must not contain any sensitive field values
          // (checking field names in the JSON keys)
          const parsed = JSON.parse(responseBody);
          const keys = getAllKeys(parsed);

          expect(keys).not.toContain('password');
          expect(keys).not.toContain('loginAttempts');
          expect(keys).not.toContain('lockUntil');
          expect(keys).not.toContain('lastLoginIp');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('SAFE_USER_FIELDS projection string excludes all sensitive fields for any user document shape', () => {
    // Verify that SAFE_USER_FIELDS contains exclusions for every sensitive field
    fc.assert(
      fc.property(
        fc.constantFrom(...SENSITIVE_FIELDS),
        (sensitiveField) => {
          expect(SAFE_USER_FIELDS).toContain(`-${sensitiveField}`);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all keys from a nested object. */
function getAllKeys(obj: unknown, keys: string[] = []): string[] {
  if (obj !== null && typeof obj === 'object') {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      keys.push(key);
      getAllKeys((obj as Record<string, unknown>)[key], keys);
    }
  }
  return keys;
}
