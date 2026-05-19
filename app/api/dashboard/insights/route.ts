import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import {
  verifyAuth,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsightsResponse {
  thisMonthTotalCents: number;
  lastMonthTotalCents: number;
  monthChangePercent: number | null;
  topCategories: Array<{ category: string; totalCents: number }>;
  dailyTrend: Array<{ date: string; totalCents: number }>;
  groupSpending: Array<{
    groupId: string;
    groupName: string;
    spentCents: number;
    currency: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a Date as a YYYY-MM-DD string in local (UTC) calendar terms.
 */
function toDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build an array of the last 30 calendar day strings (today inclusive),
 * ordered from oldest to newest.
 */
function buildLast30Days(now: Date): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - i
      )
    );
    days.push(toDateString(d));
  }
  return days;
}

// ─── GET /api/dashboard/insights ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Auth
    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    // Rate limit
    const rateLimitResult = await checkRateLimit(request, "read");
    if (!rateLimitResult.success)
      return rateLimitExceededResponse(rateLimitResult);

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // ── Fetch all groups the user belongs to ─────────────────────────────────
    const groups = await Group.find({ "members.user": userObjectId })
      .select("_id name currency")
      .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; currency: string }>>();

    if (groups.length === 0) {
      // No groups — return zeroed response
      const now = new Date();
      const dailyTrend = buildLast30Days(now).map((date) => ({
        date,
        totalCents: 0,
      }));
      const response: InsightsResponse = {
        thisMonthTotalCents: 0,
        lastMonthTotalCents: 0,
        monthChangePercent: null,
        topCategories: [],
        dailyTrend,
        groupSpending: [],
      };
      return NextResponse.json({ success: true, data: response });
    }

    const groupIds = groups.map((g) => g._id);

    // Build a lookup map: groupId string → { name, currency }
    const groupInfoMap = new Map<
      string,
      { name: string; currency: string }
    >();
    for (const g of groups) {
      groupInfoMap.set(String(g._id), {
        name: g.name,
        currency: g.currency ?? "USD",
      });
    }

    // ── Compute date boundaries ───────────────────────────────────────────────
    const now = new Date();

    // Current month: [start of this month, now]
    const thisMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    // Previous month: [start of last month, start of this month)
    const lastMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
    );

    // Daily trend window: last 30 calendar days (today inclusive)
    const trendStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - 29 // 29 days back + today = 30 days
      )
    );

    // ── Single aggregate with $facet ─────────────────────────────────────────
    const baseMatch = {
      group: { $in: groupIds },
      isVoided: { $ne: true },
    };

    const [result] = await Expense.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          // 1. This month total
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonthStart } } },
            {
              $group: {
                _id: null,
                totalCents: { $sum: "$amount" },
              },
            },
          ],

          // 2. Last month total
          lastMonth: [
            {
              $match: {
                createdAt: {
                  $gte: lastMonthStart,
                  $lt: thisMonthStart,
                },
              },
            },
            {
              $group: {
                _id: null,
                totalCents: { $sum: "$amount" },
              },
            },
          ],

          // 3. Top categories (all time, across all user groups)
          topCategories: [
            {
              $group: {
                _id: "$category",
                totalCents: { $sum: "$amount" },
              },
            },
            { $sort: { totalCents: -1 } },
            { $limit: 5 },
          ],

          // 4. Daily trend — last 30 calendar days
          dailyTrend: [
            { $match: { createdAt: { $gte: trendStart } } },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                  day: { $dayOfMonth: "$createdAt" },
                },
                totalCents: { $sum: "$amount" },
              },
            },
          ],

          // 5. Per-group spending (all time)
          groupSpending: [
            {
              $group: {
                _id: "$group",
                spentCents: { $sum: "$amount" },
              },
            },
          ],
        },
      },
    ]);

    // ── Build response ────────────────────────────────────────────────────────

    // Monthly totals
    const thisMonthTotalCents: number =
      result?.thisMonth?.[0]?.totalCents ?? 0;
    const lastMonthTotalCents: number =
      result?.lastMonth?.[0]?.totalCents ?? 0;

    // Month change percent — null when last month is 0 (req 4.6)
    const monthChangePercent: number | null =
      lastMonthTotalCents === 0
        ? null
        : ((thisMonthTotalCents - lastMonthTotalCents) / lastMonthTotalCents) *
          100;

    // Top categories
    const rawCategories: Array<{ _id: string; totalCents: number }> =
      result?.topCategories ?? [];
    const topCategories = rawCategories.map((c) => ({
      category: c._id ?? "other",
      totalCents: c.totalCents,
    }));

    // Daily trend — zero-fill for all 30 days (req 4.4)
    const rawDailyTrend: Array<{
      _id: { year: number; month: number; day: number };
      totalCents: number;
    }> = result?.dailyTrend ?? [];

    // Build a map from date string → totalCents
    const dailyMap = new Map<string, number>();
    for (const entry of rawDailyTrend) {
      const dateStr = `${entry._id.year}-${String(entry._id.month).padStart(
        2,
        "0"
      )}-${String(entry._id.day).padStart(2, "0")}`;
      dailyMap.set(dateStr, entry.totalCents);
    }

    // Generate all 30 days and zero-fill missing ones
    const last30Days = buildLast30Days(now);
    const dailyTrend = last30Days.map((date) => ({
      date,
      totalCents: dailyMap.get(date) ?? 0,
    }));

    // Group spending
    const rawGroupSpending: Array<{
      _id: mongoose.Types.ObjectId;
      spentCents: number;
    }> = result?.groupSpending ?? [];

    const groupSpending = rawGroupSpending
      .map((g) => {
        const gid = String(g._id);
        const info = groupInfoMap.get(gid);
        return {
          groupId: gid,
          groupName: info?.name ?? gid,
          spentCents: g.spentCents,
          currency: info?.currency ?? "USD",
        };
      })
      .sort((a, b) => b.spentCents - a.spentCents);

    const response: InsightsResponse = {
      thisMonthTotalCents,
      lastMonthTotalCents,
      monthChangePercent,
      topCategories,
      dailyTrend,
      groupSpending,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[dashboard insights GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
