import { NextRequest, NextResponse } from "next/server";

import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import User from "@/lib/models/User";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import BudgetAlertEmail from "@/emails/BudgetAlertEmail";

/**
 * GET /api/cron/budget-alerts
 * Called by Vercel Cron every 6 hours.
 * Finds groups with budgets set and alertSentAt: null, computes spending,
 * and sends notifications to all members if spending >= alertAt threshold.
 *
 * Protected by x-cron-secret header.
 * See vercel.json for cron schedule configuration.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  // Find all groups with budget set and alertSentAt: null
  const groups = await Group.find({
    "budget.limitCents": { $exists: true },
    "budget.alertSentAt": null,
  })
    .select("_id name budget members currency")
    .lean() as Array<{
      _id: unknown;
      name: string;
      currency?: string;
      budget: {
        limitCents: number;
        alertAt: number;
        period: "monthly" | "per-trip" | "total";
      };
      members: Array<{ user: unknown }>;
    }>;

  let processed = 0;
  let alertsSent = 0;
  let errors = 0;

  for (const group of groups) {
    try {
      // Compute current spending for this group (excluding voided expenses)
      const result = await Expense.aggregate([
        {
          $match: {
            group: group._id,
            isVoided: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalSpentCents: { $sum: "$amount" },
          },
        },
      ]);

      const totalSpentCents = result[0]?.totalSpentCents ?? 0;
      const spentPercent = (totalSpentCents / group.budget.limitCents) * 100;

      // Check if we need to send alerts
      if (spentPercent >= group.budget.alertAt) {
        // Notify all members
        for (const member of group.members) {
          await notify({
            userId: String(member.user),
            type: "budget_alert",
            title: "Budget alert",
            body: `Your group "${group.name}" has reached ${Math.round(spentPercent)}% of its budget limit.`,
            groupId: String(group._id),
          });
        }

        // Send budget alert emails (fire-and-forget, tasks 2.2–2.4)
        try {
          const memberIds = group.members.map((m) => m.user);
          const members = await User.find({ _id: { $in: memberIds } })
            .select("_id name email")
            .lean() as Array<{ _id: unknown; name: string; email: string }>;

          console.log(
            `[cron/budget-alerts] Sending emails to ${members.length} members for group: ${group.name}`
          );

          const groupUrl = `${process.env.NEXT_PUBLIC_APP_URL}/groups/${group._id}`;
          const isOverBudget = spentPercent >= 100;

          for (const member of members) {
            void sendEmail({
              to: member.email,
              subject: isOverBudget
                ? `Budget Alert: ${group.name} is over budget`
                : `Budget Alert: ${group.name} is approaching its budget`,
              react: BudgetAlertEmail({
                name: member.name,
                groupName: group.name,
                groupUrl,
                currentSpentCents: totalSpentCents,
                budgetLimitCents: group.budget.limitCents,
                percentUsed: spentPercent,
                currency: group.currency ?? "USD",
                isOverBudget,
              }),
              // No userId/prefsKey — budget alerts bypass opt-out
            });
          }

          console.log(`[cron/budget-alerts] Emails sent for group: ${group.name}`);
        } catch (emailError) {
          console.error(
            "[cron/budget-alerts] Email sending failed:",
            emailError,
            { groupId: group._id, groupName: group.name }
          );
          // Continue — email failure must not prevent marking the alert as sent
        }

        // Mark alert as sent
        await Group.findByIdAndUpdate(group._id, {
          "budget.alertSentAt": new Date(),
        });

        alertsSent++;
      }

      processed++;
    } catch (err) {
      // Log error and continue processing remaining groups
      console.error(
        "[cron/budget-alerts] Error processing group:",
        group._id,
        err
      );
      errors++;
    }
  }

  return NextResponse.json({ processed, alertsSent, errors });
}
