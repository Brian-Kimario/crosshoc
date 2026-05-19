import { NextRequest, NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RateLimitPreset = 'auth' | 'mutation' | 'read' | 'upload' | 'invite';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp seconds
}

// ─── Preset configuration ─────────────────────────────────────────────────────

interface PresetConfig {
  limit: number;
  windowSeconds: number;
}

const PRESETS: Record<RateLimitPreset, PresetConfig> = {
  auth:     { limit: 5,   windowSeconds: 60 },
  mutation: { limit: 30,  windowSeconds: 60 },
  read:     { limit: 100, windowSeconds: 60 },
  upload:   { limit: 10,  windowSeconds: 60 },
  invite:   { limit: 5,   windowSeconds: 3600 },
};

// ─── IP extraction ────────────────────────────────────────────────────────────

function extractIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface InMemoryEntry {
  count: number;
  resetAt: number; // Unix ms
}

const memoryStore = new Map<string, InMemoryEntry>();

function checkInMemory(key: string, preset: RateLimitPreset): RateLimitResult {
  const { limit, windowSeconds } = PRESETS[preset];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
    // Start a fresh window
    entry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, entry);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil(entry.resetAt / 1000),
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(entry.resetAt / 1000),
    };
  }

  entry.count += 1;
  memoryStore.set(key, entry);
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    reset: Math.ceil(entry.resetAt / 1000),
  };
}

// ─── Upstash backend ──────────────────────────────────────────────────────────

// Lazily initialised so the module can be imported without env vars present.
let upstashLimiters: Map<RateLimitPreset, import('@upstash/ratelimit').Ratelimit> | null = null;

async function getUpstashLimiters(): Promise<Map<RateLimitPreset, import('@upstash/ratelimit').Ratelimit> | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || url.startsWith('your_') || token.startsWith('your_')) {
    return null;
  }

  if (upstashLimiters) return upstashLimiters;

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({ url, token });
    const limiters = new Map<RateLimitPreset, import('@upstash/ratelimit').Ratelimit>();

    for (const [preset, config] of Object.entries(PRESETS) as [RateLimitPreset, PresetConfig][]) {
      limiters.set(
        preset,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
          prefix: 'rl',
        })
      );
    }

    upstashLimiters = limiters;
    return upstashLimiters;
  } catch {
    // Redis initialisation failed — fall back to in-memory
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check the rate limit for a request against the given preset.
 *
 * Returns a `RateLimitResult`. When `success` is `false` the caller should
 * return the pre-built 429 response from `rateLimitExceededResponse()`.
 */
export async function checkRateLimit(
  request: NextRequest,
  preset: RateLimitPreset
): Promise<RateLimitResult> {
  const ip = extractIp(request);
  const key = `${preset}:${ip}`;
  const { limit, windowSeconds } = PRESETS[preset];

  // Try Upstash first
  try {
    const limiters = await getUpstashLimiters();
    if (limiters) {
      const limiter = limiters.get(preset)!;
      const result = await limiter.limit(key);

      return {
        success: result.success,
        limit,
        remaining: Math.max(0, result.remaining),
        reset: Math.ceil(result.reset / 1000), // Upstash returns ms
      };
    }
  } catch {
    // Redis unreachable — fall through to in-memory
  }

  return checkInMemory(key, preset);
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/**
 * Attach rate-limit informational headers to an existing `NextResponse`.
 * Call this on every successful (non-429) response.
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.reset));
  return response;
}

/**
 * Build a 429 Too Many Requests response with `Retry-After` header.
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  const now = Math.floor(Date.now() / 1000);
  const retryAfter = Math.max(1, result.reset - now);

  return NextResponse.json(
    { error: 'Too many requests', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.reset),
      },
    }
  );
}
