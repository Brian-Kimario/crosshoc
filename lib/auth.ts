import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

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
 * Sign a JWT token
 */
export function signToken(userId: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as any);
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Set JWT token in httpOnly cookie
 */
export async function setTokenCookie(token: string, response: NextResponse) {
  const cookieStore = await cookies();
  cookieStore.set('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
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
 * Returns userId if authenticated, null otherwise
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
  return decoded?.userId || null;
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
