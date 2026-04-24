import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, SignJWT, decodeJwt } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const ROLLING_REFRESH_THRESHOLD = 24 * 60 * 60; // 24 hours

// Encode secret for jose (requires Uint8Array)
const getEncodedSecret = () => {
  if (!JWT_SECRET) return null;
  return new TextEncoder().encode(JWT_SECRET);
};

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',              // Landing page
  '/login',         // Login page
  '/register',      // Registration page
  '/invite/expired', // Expired invite page
];

// Dynamic public route patterns (regex)
const PUBLIC_ROUTE_PATTERNS = [
  /^\/join\/.+$/,   // /join/[token] - Magic links for joining groups
  /^\/invite\/.+$/,  // /invite/[token] - Invite landing pages (but NOT /invite/expired which is already in PUBLIC_ROUTES)
];

/**
 * Check if a path is a public route
 */
function isPublicRoute(path: string): boolean {
  // Check exact matches
  if (PUBLIC_ROUTES.includes(path)) return true;
  
  // Check pattern matches
  return PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(path));
}

/**
 * Get token from cookie
 */
function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get('authToken')?.value || null;
}

/**
 * Verify JWT token using jose (Edge Runtime compatible)
 */
async function verifyToken(token: string): Promise<{ userId: string } | null> {
  const secret = getEncodedSecret();
  if (!secret) return null;
  
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

/**
 * Get token remaining time in seconds using jose decode
 */
function getTokenRemainingTime(token: string): number | null {
  try {
    const decoded = decodeJwt(token);
    if (!decoded?.exp) return null;
    return decoded.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

/**
 * Check if token should be refreshed (rolling session)
 */
function shouldRefreshToken(token: string): boolean {
  const remaining = getTokenRemainingTime(token);
  if (!remaining) return false;
  return remaining < ROLLING_REFRESH_THRESHOLD;
}

/**
 * Refresh token with new 30-day expiration using jose
 */
async function refreshToken(token: string): Promise<string | null> {
  const secret = getEncodedSecret();
  if (!secret) return null;
  
  // First verify the old token
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  
  // Create new token with fresh 30-day expiration
  try {
    const newToken = await new SignJWT({ userId: decoded.userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret);
    return newToken;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = getTokenFromRequest(request);
  
  // Check if this is a public route
  const isPublic = isPublicRoute(pathname);
  
  // If no token and route is public, allow access
  if (!token) {
    if (isPublic) {
      return NextResponse.next();
    }
    // Redirect to login with return URL for protected routes
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Token exists, verify it
  const decoded = await verifyToken(token);
  
  if (!decoded) {
    // Invalid token - clear cookie and redirect
    if (isPublic) {
      // For public routes with invalid token, just proceed (they'll be treated as guest)
      const response = NextResponse.next();
      response.cookies.delete('authToken');
      return response;
    }
    // For protected routes, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('authToken');
    return response;
  }
  
  // Valid token - handle rolling session refresh
  const response = NextResponse.next();
  
  if (shouldRefreshToken(token)) {
    const newToken = await refreshToken(token);
    if (newToken) {
      // Set refreshed token in cookie
      response.cookies.set('authToken', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      });
    }
  }
  
  // Redirect authenticated users from / to /dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};