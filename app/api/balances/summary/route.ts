import { NextRequest } from "next/server";
import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import { calculateUserBalances } from "@/lib/balance-server";

/**
 * GET /api/balances/summary
 * Returns the authenticated user's aggregate balance across all groups.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const summary = await calculateUserBalances(userId);
    return successResponse(summary);
  } catch (err) {
    console.error("Balance summary error:", err);
    return errorResponse("Failed to fetch balance summary", 500);
  }
}
