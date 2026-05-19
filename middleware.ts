import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit-edge";
import { shouldRefreshToken, getTokenFromRequest } from "@/lib/auth-edge";

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // ── Rate limiting for auth endpoints ──────────────────────────────────────
    // Skip /api/auth/me - it's a read-only endpoint, not a sensitive auth action
    if (pathname.startsWith("/api/auth/") && pathname !== "/api/auth/me") {
      const result = await checkRateLimit(request, "auth");
      if (!result.success) {
        return rateLimitExceededResponse(result);
      }
    }

    // ── Rate limiting for upload endpoints ────────────────────────────────────
    if (pathname.startsWith("/api/upload/")) {
      const result = await checkRateLimit(request, "upload");
      if (!result.success) {
        return rateLimitExceededResponse(result);
      }
    }

    // ── Admin redirect — ensure auth cookie exists ────────────────────────────
    const isAdminPath = pathname.startsWith("/admin");
    if (isAdminPath) {
      const token =
        request.cookies.get("token")?.value ??
        request.cookies.get("authToken")?.value ??
        request.cookies.get("auth-token")?.value;

      if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    // ── Rolling session — flag token for refresh if close to expiry ─────────
    // Actual refresh happens via API call since Edge can't re-sign JWTs
    const response = NextResponse.next();

    const authToken = getTokenFromRequest(request);
    if (authToken && shouldRefreshToken(authToken)) {
      // Add header to indicate token needs refresh
      // Client-side or API routes will handle the actual refresh
      response.headers.set("X-Token-Needs-Refresh", "true");
    }

    return response;
  } catch (error) {
    console.error("[proxy] Error:", error);
    // Return JSON error instead of letting it bubble up as HTML
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/auth/:path*", "/api/upload/:path*"],
};
