/**
 * lib/sanitize.ts — MongoDB injection sanitization and safe field projection
 *
 * Requirements: 5.1, 5.2, 7.1
 */

/**
 * MongoDB field projection string that excludes sensitive user fields from
 * all User.find*() calls that return data to clients.
 *
 * Validates: Requirement 7.1
 */
export const SAFE_USER_FIELDS: string =
  "-password -loginAttempts -lockUntil -lastLoginIp";

/**
 * Recursively traverses an input value and removes any object key that:
 * - starts with `$` (MongoDB operator injection)
 * - contains `.` (dot-notation injection)
 *
 * Arrays are traversed element-by-element. Primitives are returned as-is.
 *
 * Validates: Requirements 5.1, 5.4
 */
export function sanitizeMongoInput<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeMongoInput(item)) as unknown as T;
  }

  if (input !== null && typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>)) {
      // Drop keys starting with '$' or containing '.'
      if (key.startsWith("$") || key.includes(".")) {
        continue;
      }
      result[key] = sanitizeMongoInput(
        (input as Record<string, unknown>)[key]
      );
    }
    return result as unknown as T;
  }

  // Primitives (string, number, boolean, null, undefined, etc.) pass through
  return input;
}

/**
 * Escapes all regex special characters in a string so it can be safely
 * passed to `new RegExp()` without unintended pattern interpretation.
 *
 * Characters escaped: \ ^ $ . | ? * + ( ) [ ] { }
 *
 * Validates: Requirements 5.2, 5.5
 */
export function sanitizeRegex(input: string): string {
  // Escape backslash first, then all other special regex characters
  return input.replace(/[\\^$.|?*+()[\]{}]/g, "\\$&");
}

/**
 * Sanitizes a filename for safe storage:
 * - Strips path traversal sequences (`../`, `./`)
 * - Removes any character outside `[a-zA-Z0-9._-]`
 * - Truncates to 255 characters
 *
 * Validates: Requirement 6.5 (Property 10)
 */
export function sanitizeFilename(name: string): string {
  // Remove path traversal sequences
  let sanitized = name.replace(/\.\.\//g, "").replace(/\.\//g, "");

  // Strip characters outside the safe set
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "");

  // Truncate to 255 characters
  return sanitized.slice(0, 255);
}
