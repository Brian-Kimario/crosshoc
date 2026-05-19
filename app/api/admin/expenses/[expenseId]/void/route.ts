import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { ExpenseVoidedEmail } from "@/emails/ExpenseVoidedEmail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error) return error;

  // 2. DB connection
  await dbConnect();

  const { expenseId } = await params;

  try {
    // 3. Parse and validate reason
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const reason = (body as any)?.reason;
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    // 4. Fetch the expense (populate group name and split user emails)
    const expense = await Expense.findById(expenseId)
      .populate("group", "name")
      .populate("splits.user", "name email");
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // 5. Check if already voided
    if (expense.isVoided === true) {
      return NextResponse.json({ error: "Expense is already voided" }, { status: 409 });
    }

    // 6. Capture before state for audit log
    const groupId    = (expense.group as any)?._id?.toString() ?? expense.group.toString();
    const before = {
      description: expense.description,
      amount:      expense.amount,
      groupId,
      splits:      expense.splits.map((s: any) => ({
        user:   (s.user as any)?._id?.toString() ?? s.user.toString(),
        amount: s.amount,
      })),
    };

    // 7. Void the expense
    const voidedAt = new Date();
    expense.isVoided = true;
    expense.voidedAt = voidedAt;
    await expense.save();

    const resourceId = expense._id.toString();

    // 8. Fire-and-forget: invalidate balance cache
    invalidateBalanceCache(groupId).catch((err) =>
      logError("[admin void expense] invalidateBalanceCache", err, { expenseId, groupId })
    );

    // 9. Fire-and-forget: audit log
    logAction({
      action:     "expense.admin_voided",
      actorId:    session!.userId,
      actorName:  session!.name,
      groupId,
      resourceId,
      before,
      after: { reason: reason.trim(), voidedAt },
    }).catch((err) =>
      logError("[admin void expense] logAction", err, { expenseId, groupId })
    );

    // 10. Fire-and-forget: notify every user in splits
    for (const split of expense.splits) {
      const userId = (split.user as any)?._id?.toString() ?? split.user.toString();
      notify({
        userId,
        type:       "expense_deleted",
        title:      "Expense voided by admin",
        body:       `The expense "${expense.description}" has been voided by an admin.`,
        groupId,
        resourceId,
      }).catch((err) =>
        logError("[admin void expense] notify", err, { expenseId, userId })
      );
    }

    // 11. Fire-and-forget: send ExpenseVoidedEmail to each split user
    const formattedAmount = '$' + (expense.amount / 100).toFixed(2);
    const groupName = (expense.group as any)?.name ?? groupId;
    for (const split of expense.splits) {
      const splitUser = split.user as any;
      if (!splitUser?.email) continue;
      sendEmail({
        to: splitUser.email,
        subject: `An expense in ${groupName} has been voided`,
        react: ExpenseVoidedEmail({
          name: splitUser.name ?? splitUser.email,
          expenseDescription: expense.description,
          amount: formattedAmount,
          groupName,
          reason: reason.trim(),
          supportEmail: process.env.SUPPORT_EMAIL ?? 'support@spliteasy.app',
        }),
        userId: splitUser._id.toString(),
        prefsKey: 'expenseVoided',
      }).catch((err) =>
        logError("[admin void expense] sendEmail", err, { expenseId, userId: splitUser._id })
      );
    }

    // 12. Return success
    return NextResponse.json({ success: true, voidedAt });
  } catch (err) {
    logError("[admin void expense]", err, { expenseId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
