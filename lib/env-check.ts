/**
 * Environment variable validation module.
 * Called by dbConnect() before every connection attempt to fail fast on misconfiguration.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.5
 */

/** Required environment variables — at least one of the DB vars must be present. */
const REQUIRED_VARS = ['JWT_SECRET', 'NEXTAUTH_URL'] as const;

/** Optional Redis vars — warn if absent, never throw. */
const OPTIONAL_REDIS_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

/**
 * Returns true if the variable is present and non-empty.
 */
function isDefined(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates required environment variables at startup.
 *
 * - In `development` or `test`: throws an Error listing all missing variable names.
 * - In `production`: calls console.error listing all missing variable names; does not throw.
 * - Optional Upstash Redis vars: logs a console.warn if absent; never throws.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  // Check the DB connection variable — accept either MONGODB_URI or DB_CONNECTION_STRING
  const hasDbVar = isDefined('MONGODB_URI') || isDefined('DB_CONNECTION_STRING');
  if (!hasDbVar) {
    missing.push('MONGODB_URI');
  }

  // Check the remaining required variables
  for (const name of REQUIRED_VARS) {
    if (!isDefined(name)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    const env = process.env.NODE_ENV;

    if (env === 'production') {
      console.error(`[env-check] ${message}`);
    } else {
      // development, test, or undefined — throw to fail fast
      throw new Error(message);
    }
  }

  // Warn about optional Upstash Redis variables (rate-limiter falls back to in-memory)
  const missingRedis = OPTIONAL_REDIS_VARS.filter((name) => !isDefined(name));
  if (missingRedis.length > 0) {
    console.warn(
      `[env-check] Optional environment variables not set (rate-limiter will use in-memory fallback): ${missingRedis.join(', ')}`
    );
  }
}
