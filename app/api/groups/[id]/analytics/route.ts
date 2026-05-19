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

type Period = "7d" | "30d" | "90d" | "all";

interface AnalyticsResponse {
  period: Period;
  currency: string;
  totalSpentCents: number;
  totalExpenses: number;
  avgExpenseCents: number;
  largestExpense: { description: string; amountCents: number } | null;
  categoryBreakdown: Array<{
    category: string;
    totalCents: number;
    percentage: number;
  }>;
  timeline: Array<{ week: string; totalCents: number }>;
  memberBreakdown: Array<{
    userId: string;
    name: string;
    paidCents: number;
    owedCents: number;
  }>;
  budgetUtilization: {
    limitCents: number;
    spentCents: number;
    usedPercent: number;
    remainingCents: number;
    isOverBudget: boolean;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PERIODS: Period[] = ["7d", "30d", "90d", "all"];

function periodToDays(period: Period): number | null {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return null;
  }
}

// ─── GET /api/groups/[id]/analytics ──────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    // Auth
    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    // Rate limit
    const rateLimitResult = await checkRateLimit(request, "read");
    if (!rateLimitResult.success)
      return rateLimitExceededResponse(rateLimitResult);

    // Validate group id
    const { id: groupId } = await params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Invalid group id", 400);
    }

    // Fetch group (need members + currency + budget)
    const group = await Group.findById(groupId)
      .populate("members.user", "name")
      .lean<{
        _id: mongoose.Types.ObjectId;
        members: Array<{ user: { _id: mongoose.Types.ObjectId; name: string } }>;
        currency: string;
        budget?: {
          limitCents: number;
          currency: string;
          period: string;
          alertAt: number;
          alertSentAt: Date | null;
          createdAt: Date;
        };
      }>();

    if (!group) return errorResponse("Group not found", 404);

    // Membership check
    const isMember = group.members.some(
      (m) => String(m.user._id) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Parse period query param
    const url = new URL(request.url);
    const rawPeriod = url.searchParams.get("period") ?? "all";
    const period: Period = VALID_PERIODS.includes(rawPeriod as Period)
      ? (rawPeriod as Period)
      : "all";

    // Build date filter
    const days = periodToDays(period);
    const dateFilter: Record<string, unknown> =
      days !== null
        ? { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
        : {};

    const matchStage: Record<string, unknown> = {
      group: new mongoose.Types.ObjectId(groupId),
      isVoided: { $ne: true },
    };
    if (days !== null) {
      matchStage.createdAt = dateFilter;
    }

    // ── Single aggregate with $facet ─────────────────────────────────────────
    const [result] = await Expense.aggregate([
      { $match: matchStage },
      {
        $facet: {
          // 1. Summary stats
          summary: [
            {
              $group: {
                _id: null,
                totalSpentCents: { $sum: "$amount" },
                totalExpenses: { $sum: 1 },
                avgExpenseCents: { $avg: "$amount" },
                largestAmount: { $max: "$amount" },
              },
            },
          ],

          // 2. Largest expense document (for description)
          largestExpense: [
            { $sort: { amount: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                description: 1,
                amountCents: "$amount",
              },
            },
          ],

          // 3. Category breakdown
          categoryBreakdown: [
            {
              $group: {
                _id: "$category",
                totalCents: { $sum: "$amount" },
              },
            },
            { $sort: { totalCents: -1 } },
          ],

          // 4. ISO-week timeline
          timeline: [
            {
              $group: {
                _id: {
                  isoWeekYear: { $isoWeekYear: "$createdAt" },
                  isoWeek: { $isoWeek: "$createdAt" },
                },
                totalCents: { $sum: "$amount" },
              },
            },
            {
              $sort: {
                "_id.isoWeekYear": 1,
                "_id.isoWeek": 1,
              },
            },
          ],

          // 5. Member paid breakdown (paidBy field)
          memberPaid: [
            {
              $match: { paidBy: { $ne: null } },
            },
            {
              $group: {
                _id: "$paidBy",
                paidCents: { $sum: "$amount" },
              },
            },
          ],

          // 6. Member owed breakdown (splits array)
          memberOwed: [
            { $unwind: "$splits" },
            {
              $group: {
                _id: "$splits.user",
                owedCents: { $sum: "$splits.amount" },
              },
            },
          ],
        },
      },
    ]);

    // ── Build response from facet results ────────────────────────────────────

    // Summary
    const summaryDoc = result?.summary?.[0];
    const totalSpentCents: number = summaryDoc?.totalSpentCents ?? 0;
    const totalExpenses: number = summaryDoc?.totalExpenses ?? 0;
    const avgExpenseCents: number = summaryDoc
      ? Math.round(summaryDoc.avgExpenseCents ?? 0)
      : 0;

    // Largest expense
    const largestExpenseDoc = result?.largestExpense?.[0] ?? null;
    const largestExpense: AnalyticsResponse["largestExpense"] =
      largestExpenseDoc
        ? {
            description: largestExpenseDoc.description,
            amountCents: largestExpenseDoc.amountCents,
          }
        : null;

    // Category breakdown with percentages
    const rawCategories: Array<{ _id: string; totalCents: number }> =
      result?.categoryBreakdown ?? [];
    const categoryBreakdown: AnalyticsResponse["categoryBreakdown"] =
      rawCategories.length === 0
        ? []
        : (() => {
            const grandTotal = rawCategories.reduce(
              (sum, c) => sum + c.totalCents,
              0
            );
            // Compute raw percentages
            const withRaw = rawCategories.map((c) => ({
              category: c._id ?? "other",
              totalCents: c.totalCents,
              rawPct: grandTotal > 0 ? (c.totalCents / grandTotal) * 100 : 0,
            }));
            // Round and adjust last item so sum == 100
            let allocated = 0;
            const rounded = withRaw.map((c, i) => {
              if (i === withRaw.length - 1) {
                return {
                  category: c.category,
                  totalCents: c.totalCents,
                  percentage: Math.round((100 - allocated) * 100) / 100,
                };
              }
              const pct = Math.round(c.rawPct * 100) / 100;
              allocated += pct;
              return {
                category: c.category,
                totalCents: c.totalCents,
                percentage: pct,
              };
            });
            return rounded;
          })();

    // Timeline — format as YYYY-Www
    const rawTimeline: Array<{
      _id: { isoWeekYear: number; isoWeek: number };
      totalCents: number;
    }> = result?.timeline ?? [];
    const timeline: AnalyticsResponse["timeline"] = rawTimeline.map((t) => ({
      week: `${t._id.isoWeekYear}-W${String(t._id.isoWeek).padStart(2, "0")}`,
      totalCents: t.totalCents,
    }));

    // Member breakdown — merge paid + owed maps
    const paidMap = new Map<string, number>();
    for (const p of result?.memberPaid ?? []) {
      paidMap.set(String(p._id), p.paidCents);
    }
    const owedMap = new Map<string, number>();
    for (const o of result?.memberOwed ?? []) {
      owedMap.set(String(o._id), o.owedCents);
    }

    // Build a set of all user IDs that appear in either map
    const memberUserIds = new Set<string>([
      ...paidMap.keys(),
      ...owedMap.keys(),
    ]);

    // Build a name lookup from the group members
    const nameLookup = new Map<string, string>();
    for (const m of group.members) {
      nameLookup.set(String(m.user._id), m.user.name);
    }

    const memberBreakdown: AnalyticsResponse["memberBreakdown"] = Array.from(
      memberUserIds
    )
      .map((uid) => ({
        userId: uid,
        name: nameLookup.get(uid) ?? uid,
        paidCents: paidMap.get(uid) ?? 0,
        owedCents: owedMap.get(uid) ?? 0,
      }))
      .sort((a, b) => b.paidCents - a.paidCents);

    // Budget utilization
    let budgetUtilization: AnalyticsResponse["budgetUtilization"] = null;
    if (group.budget?.limitCents) {
      const limitCents = group.budget.limitCents;
      const spentCents = totalSpentCents;
      const usedPercent =
        limitCents > 0
          ? Math.round((spentCents / limitCents) * 10000) / 100
          : 0;
      const remainingCents = limitCents - spentCents;
      budgetUtilization = {
        limitCents,
        spentCents,
        usedPercent,
        remainingCents,
        isOverBudget: spentCents > limitCents,
      };
    }

    const response: AnalyticsResponse = {
      period,
      currency: group.currency ?? "USD",
      totalSpentCents,
      totalExpenses,
      avgExpenseCents,
      largestExpense,
      categoryBreakdown,
      timeline,
      memberBreakdown,
      budgetUtilization,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("[analytics GET]", error);
    return errorResponse("Internal server error", 500);
  }
}
