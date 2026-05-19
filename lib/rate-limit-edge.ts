/**
 * Edge Runtime Compatible Rate Limiting
 * Uses in-memory store only (no Redis dependency)
 */

import { NextRequest, NextResponse } from 'next/server';

export type RateLimitPreset = 'auth' | 'mutation' | 'read' | 'upload' | 'invite';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

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

interface InMemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, InMemoryEntry>();

function checkInMemory(key: string, preset: RateLimitPreset): RateLimitResult {
  const { limit, windowSeconds } = PRESETS[preset];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = memoryStore.get(key);

  if (!entry || now >= entry.resetAt) {
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

export async function checkRateLimit(
  request: NextRequest,
  preset: RateLimitPreset
): Promise<RateLimitResult> {
  const ip = extractIp(request);
  const key = `${preset}:${ip}`;
  return checkInMemory(key, preset);
}

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
