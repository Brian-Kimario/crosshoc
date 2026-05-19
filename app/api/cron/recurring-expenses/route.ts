import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import RecurringExpense from "@/lib/models/RecurringExpense";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";

/**
 * Advance a date by one frequency period.
 * Returns a new Date — does not mutate the input.
 */
export function advanceNextDueAt(
  date: Date,
  frequency: "daily" | "weekly" | "biweekly" | "monthly"
): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly": {
      // Clamp to last day of target month to avoid overflow
      // e.g. Jan 31 + 1 month → Feb 28/29 (not March 2/3)
      const targetMonth = next.getMonth() + 1;
      const targetYear = targetMonth === 12 ? next.getFullYear() + 1 : next.getFullYear();
      const normalizedMonth = targetMonth % 12;
      const daysInTarget = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(next.getDate(), daysInTarget);
      next.setFullYear(targetYear, normalizedMonth, clampedDay);
      break;
    }
  }
  return next;
}

/**
 * GET /api/cron/recurring-expenses
 * Called by Vercel Cron daily at 06:00 UTC.
 * Finds all due recurring expenses and generates Expense documents from them.
 *
 * Vercel cron config (vercel.json):
 *   { "path": "/api/cron/recurring-expenses", "schedule": "0 6 * * *" }
 *
 * Protected by x-cron-secret header.
 * Requirements: 10.1–10.8
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const now = new Date();

  // Requirement 10.2: query all active templates where nextDueAt <= now
  const dueTemplates = await RecurringExpense.find({
    isActive: true,
    nextDueAt: { $lte: now },
  }).lean() as any[];

  let processed = 0;
  let failed = 0;

  for (const template of dueTemplates) {
    try {
      // Requirement 10.3: create a new Expense from the template fields
      await Expense.create({
        group: template.group,
        description: template.description,
        amount: template.amount,
        category: template.category,
        paidBy: template.paidBy,
        splits: template.splits,
        splitType: template.splitType,
        createdBy: template.createdBy,
        recurringConfig: {
          enabled: true,
          frequency: template.frequency,
          templateId: template._id,
          generationCount: template.generationCount + 1,
        },
        createdAt: now,
      });

      // Requirement 10.4: advance nextDueAt by one period
      const nextDueAt = advanceNextDueAt(new Date(template.nextDueAt), template.frequency);

      // Requirement 10.7: if nextDueAt would exceed endDate, deactivate instead
      const shouldDeactivate =
        template.endDate && nextDueAt > new Date(template.endDate);

      // Requirement 10.5: increment generationCount and set lastGeneratedAt
      await RecurringExpense.findByIdAndUpdate(template._id, {
        $set: {
          nextDueAt: shouldDeactivate ? template.nextDueAt : nextDueAt,
          lastGeneratedAt: now,
          isActive: shouldDeactivate ? false : true,
        },
        $inc: { generationCount: 1 },
      });

      // Requirement 10.6: invalidate cachedBalances on the affected group
      await Group.findByIdAndUpdate(template.group, {
        $set: { cachedBalances: null },
      });

      // Requirement 10.8: send notifications to all split participants
      const splitUserIds: string[] = (template.splits ?? []).map(
        (s: { user: unknown }) => String(s.user)
      );
      for (const userId of splitUserIds) {
        await notify({
          userId,
          type: "expense_added",
          title: "Recurring expense added",
          body: `A recurring expense "${template.description}" has been automatically added to your group.`,
          groupId: String(template.group),
          amount: template.amount,
        });
      }

      processed++;
    } catch (err) {
      logError(`[cron/recurring-expenses] Failed to process template ${template._id}`, err);
      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}
