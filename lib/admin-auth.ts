import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";

export interface AdminSession {
  userId: string;
  email: string;
  name: string;
  isAdmin: true;
}

/**
 * Verifies the current request is from an admin user.
 * Returns the admin session or null.
 * Use in both Server Components and API routes.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();

    // Get the auth token — check both common cookie names
    const token =
      cookieStore.get("token")?.value ??
      cookieStore.get("authToken")?.value ??
      cookieStore.get("auth-token")?.value ??
      cookieStore.get("session")?.value;

    if (!token) return null;

    // Verify JWT using the existing verifyToken function from lib/auth.ts
    const decoded = verifyToken(token);
    if (!decoded?.userId) return null;

    // Check isAdmin in DB — don't trust the token alone
    await dbConnect();
    const user = await User.findById(decoded.userId)
      .select("email name isAdmin")
      .lean();

    if (!user || !(user as any).isAdmin) return null;

    return {
      userId: decoded.userId,
      email: (user as any).email,
      name: (user as any).name,
      isAdmin: true,
    };
  } catch {
    return null;
  }
}

/**
 * Use this in API routes to guard admin endpoints.
 * Returns 401/403 response if not admin, or the session.
 */
export async function requireAdmin(): Promise<{
  session: AdminSession | null;
  error: Response | null;
}> {
  const session = await getAdminSession();
  if (!session) {
    return {
      session: null,
      error: new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { session, error: null };
}
