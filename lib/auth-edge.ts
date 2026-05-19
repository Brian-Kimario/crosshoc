/**
 * Edge Runtime Compatible Auth Utilities
 * Uses Web Crypto API instead of Node.js crypto
 */

import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;
const ROLLING_REFRESH_THRESHOLD = 24 * 60 * 60; // 24 hours in seconds

interface JWTPayload {
  userId: string;
  tokenVersion: number;
  exp?: number;
  iat?: number;
}

/**
 * Decode base64url string
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padding = "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + padding;
  return atob(base64);
}

/**
 * Decode JWT payload without verification (safe for Edge)
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Verify JWT using Web Crypto API (Edge compatible)
 */
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Create signature verification key
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Create signing input
    const signingInput = parts[0] + "." + parts[1];
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(signingInput)
    );

    // Convert signature to base64url
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Compare signatures
    if (signatureBase64 !== parts[2]) {
      return null;
    }

    // Decode and verify expiration
    const payload = decodeJWT(token);
    if (!payload) return null;

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null; // Token expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Get token from request
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get("authToken")?.value || null;
}

/**
 * Get token expiration time in seconds
 */
export function getTokenRemainingTime(token: string): number | null {
  try {
    const payload = decodeJWT(token);
    if (!payload?.exp) return null;
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

/**
 * Check if token should be refreshed (rolling session)
 */
export function shouldRefreshToken(token: string): boolean {
  const remaining = getTokenRemainingTime(token);
  if (!remaining) return false;
  return remaining < ROLLING_REFRESH_THRESHOLD;
}

/**
 * Verify and decode token (Edge compatible)
 */
export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined");
    return null;
  }
  return verifyJWT(token, JWT_SECRET);
}

/**
 * Simple token refresh - returns new token with extended expiration
 * Note: In production, you'd want to re-sign with the server secret
 * This is a simplified version for middleware use
 */
export async function refreshTokenEdge(token: string): Promise<string | null> {
  const payload = await verifyTokenEdge(token);
  if (!payload) return null;

  // For Edge runtime, we can't easily re-sign JWTs without the proper crypto setup
  // The actual refresh should happen via API call or server action
  // This function returns null to indicate middleware can't refresh
  return null;
}
