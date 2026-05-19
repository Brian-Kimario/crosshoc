/**
 * lib/logger.ts — Structured error logging
 *
 * Requirements: 11.1, 11.2, 11.4, 11.5
 */

/**
 * Logs a structured error object and optionally forwards it to Sentry.
 *
 * - If `SENTRY_DSN` is defined, forwards to Sentry via `captureException`.
 * - Otherwise writes a structured object to `console.error`.
 * - The entire body is wrapped in try/catch; any secondary error is silently
 *   suppressed so this function can never mask the original error.
 *
 * Validates: Requirements 11.1, 11.2, 11.4, 11.5
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  try {
    const message =
      error instanceof Error ? error.message : String(error);

    const logEntry = {
      context,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };

    if (process.env.SENTRY_DSN) {
      // Use a runtime-only require path so bundlers don't statically analyse
      // the import. Sentry is an optional peer dependency — if it isn't
      // installed the catch block falls back to console.error.
      const sentryPath = '@sentry/nextjs';
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      Promise.resolve().then(() => import(/* webpackIgnore: true */ sentryPath))
        .then((Sentry: any) => {
          Sentry.captureException(error, {
            extra: { context, ...metadata },
          });
        })
        .catch(() => {
          // Sentry unavailable — fall back to console.error
          console.error(logEntry);
        });
    } else {
      console.error(logEntry);
    }
  } catch {
    // Silently suppress any secondary error to avoid masking the original.
  }
}
