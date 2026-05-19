import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';

// 30-day rolling session - user stays logged in for 30 days of inactivity
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const ROLLING_REFRESH_THRESHOLD = 24 * 60 * 60; // Refresh if less than 24h remaining

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return secret;
};

/**
 * Hash a password using bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

/**
 * Compare a plain password with a hashed password
 */
export async function comparePasswords(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcryptjs.compare(password, hashedPassword);
}

/**
 * Sign a JWT token — embeds userId and tokenVersion in the payload
 */
export function signToken(userId: string, tokenVersion: number): string {
  const secret = getJwtSecret();
  return jwt.sign({ userId, tokenVersion }, secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as any);
}

/**
 * Sign a JWT token with a sessionId — embeds userId, tokenVersion, and sessionId in the payload.
 * Use this for new logins so the session can be tracked and revoked individually.
 */
export function signTokenWithSession(
  userId: string,
  tokenVersion: number,
  sessionId: string
): string {
  const secret = getJwtSecret();
  return jwt.sign({ userId, tokenVersion, sessionId }, secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as any);
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): {
  userId: string;
  tokenVersion: number;
  sessionId?: string;
} | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      tokenVersion: number;
      sessionId?: string;
    };
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Set JWT token in httpOnly cookie
 * 30-day rolling session - extends on each authenticated request
 */
export async function setTokenCookie(token: string, response?: NextResponse) {
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
  
  cookieStore.set('authToken', token, cookieOptions);
  
  // If response provided, also set via NextResponse for middleware usage
  if (response) {
    response.cookies.set('authToken', token, cookieOptions);
  }
}

/**
 * Get token expiration time in seconds
 */
export function getTokenRemainingTime(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded?.exp) return null;
    return decoded.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

/**
 * Check if token should be refreshed (rolling session)
 * Returns true if less than 24h remaining
 */
export function shouldRefreshToken(token: string): boolean {
  const remaining = getTokenRemainingTime(token);
  if (!remaining) return false;
  return remaining < ROLLING_REFRESH_THRESHOLD;
}

/**
 * Refresh token with new 30-day expiration, preserving tokenVersion
 */
export function refreshToken(token: string): string | null {
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return signToken(decoded.userId, decoded.tokenVersion);
}

/**
 * Get token from cookie
 */
export async function getTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  return token || null;
}

/**
 * Get token from request (for Route Handlers)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get('authToken')?.value || null;
}

/**
 * Clear auth token cookie
 */
export async function clearTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('authToken');
}

/**
 * Middleware to verify authentication
 * Returns userId if authenticated, null otherwise.
 * Performs a DB lookup to validate tokenVersion and isDisabled status.
 * If the JWT contains a sessionId, also verifies the session exists in the user's sessions array.
 */
export async function verifyAuth(request?: NextRequest): Promise<string | null> {
  let token: string | null = null;
  
  if (request) {
    // Use request cookies if provided (for Route Handlers)
    token = getTokenFromRequest(request);
  } else {
    // Fall back to cookies store (for Server Components)
    token = await getTokenFromCookie();
  }
  
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;

  // DB lookup to validate tokenVersion and account status
  await dbConnect();

  // If JWT contains a sessionId, fetch sessions too so we can validate in one query
  const selectFields = decoded.sessionId
    ? 'tokenVersion isDisabled sessions'
    : 'tokenVersion isDisabled';

  const user = await User.findById(decoded.userId).select(selectFields);
  if (!user) return null;
  if (user.isDisabled) return null;
  if (decoded.tokenVersion !== user.tokenVersion) return null;

  // If JWT contains a sessionId, verify it exists in the sessions array
  if (decoded.sessionId) {
    const sessionExists = user.sessions?.some(
      (s: any) => s.sessionId === decoded.sessionId
    );
    if (!sessionExists) return null; // session was revoked

    // Fire-and-forget lastSeenAt refresh — do not await to keep request fast
    User.findOneAndUpdate(
      { _id: decoded.userId, 'sessions.sessionId': decoded.sessionId },
      { $set: { 'sessions.$.lastSeenAt': new Date() } }
    ).catch(() => {});
  }

  return decoded.userId;
}

/**
 * Response helper for authenticated endpoints
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized. Please login.' },
    { status: 401 }
  );
}

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

export function successResponse(data: any, status: number = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}
