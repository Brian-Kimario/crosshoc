import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import Settlement from "@/lib/models/Settlement";
import { getGroupBalances } from "@/lib/balance-cache";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { GroupDeletedEmail } from "@/emails/GroupDeletedEmail";

const PAGE_LIMIT = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { groupId } = await params;

  const { searchParams } = new URL(req.url);
  const expensePage    = Math.max(1, parseInt(searchParams.get("expensePage")    ?? "1", 10) || 1);
  const settlementPage = Math.max(1, parseInt(searchParams.get("settlementPage") ?? "1", 10) || 1);

  try {
    // Fetch the group with members populated
    const group = await Group.findById(groupId)
      .populate("members.user", "name email")
      .lean() as any;

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Fetch paginated expenses (populate paidBy name)
    const [expenses, expenseTotal] = await Promise.all([
      Expense.find({ group: groupId })
        .populate("paidBy", "name")
        .sort({ createdAt: -1 })
        .skip((expensePage - 1) * PAGE_LIMIT)
        .limit(PAGE_LIMIT)
        .lean(),
      Expense.countDocuments({ group: groupId }),
    ]);

    // Fetch paginated settlements (populate fromUser and toUser names)
    const [settlements, settlementTotal] = await Promise.all([
      Settlement.find({ group: groupId })
        .populate("fromUser", "name")
        .populate("toUser", "name")
        .sort({ createdAt: -1 })
        .skip((settlementPage - 1) * PAGE_LIMIT)
        .limit(PAGE_LIMIT)
        .lean(),
      Settlement.countDocuments({ group: groupId }),
    ]);

    // Get member balances from cache (recalculates if stale)
    const balances = await getGroupBalances(groupId);
    const balanceMap = new Map(balances.map((b) => [b.userId, b.balance]));

    // Build members array with balance data
    const members = (group.members ?? []).map((m: any) => {
      const user = m.user ?? {};
      const userId = user._id?.toString() ?? m.user?.toString() ?? "";
      return {
        userId,
        name:       user.name  ?? "",
        email:      user.email ?? "",
        role:       m.role ?? "member",
        joinedAt:   m.joinedAt ?? null,
        balance:    balanceMap.get(userId) ?? 0,
      };
    });

    // Build expenses array
    const expensesData = (expenses as any[]).map((e) => ({
      _id:         e._id.toString(),
      description: e.description,
      amount:      e.amount,
      category:    e.category ?? "other",
      splitType:   e.splitType,
      paidByName:  e.paidBy?.name ?? null,
      createdAt:   e.createdAt,
      isVoided:    e.isVoided ?? false,
      voidedAt:    e.voidedAt ?? null,
    }));

    // Build settlements array
    const settlementsData = (settlements as any[]).map((s) => ({
      _id:          s._id.toString(),
      fromUserName: s.fromUser?.name ?? "",
      toUserName:   s.toUser?.name   ?? "",
      amount:       s.amount,
      method:       s.method,
      status:       s.status,
      createdAt:    s.createdAt,
    }));

    return NextResponse.json({
      group: {
        _id:             group._id.toString(),
        name:            group.name,
        currency:        group.currency ?? "USD",
        createdAt:       group.createdAt,
        inviteToken:     group.inviteToken     ?? null,
        inviteExpiresAt: group.inviteExpiresAt ?? null,
        memberCount:     (group.members ?? []).length,
      },
      members,
      expenses: {
        data:  expensesData,
        total: expenseTotal,
        page:  expensePage,
      },
      settlements: {
        data:  settlementsData,
        total: settlementTotal,
        page:  settlementPage,
      },
    });
  } catch (err) {
    logError("[admin groups GET detail]", err, { groupId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error) return error;

  // 2. DB connection
  await dbConnect();

  const { groupId } = await params;

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

    // 4. Fetch the group with members populated (needed for notifications)
    const group = await Group.findById(groupId)
      .populate("members.user", "name email") as any;

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // 5. Count associated documents before deletion
    const [expenseCount, settlementCount] = await Promise.all([
      Expense.countDocuments({ group: groupId }),
      Settlement.countDocuments({ group: groupId }),
    ]);

    // Capture member list before deletion for notifications
    const members = (group.members ?? []).map((m: any) => ({
      userId: m.user?._id?.toString() ?? m.user?.toString() ?? "",
      name: m.user?.name ?? "",
      email: m.user?.email ?? "",
    }));

    const memberCount = members.length;
    const groupName   = group.name as string;
    const resourceId  = group._id.toString();

    // 6. Delete the group and all associated documents
    const [expenseResult, settlementResult] = await Promise.all([
      Expense.deleteMany({ group: groupId }),
      Settlement.deleteMany({ group: groupId }),
    ]);
    await Group.findByIdAndDelete(groupId);

    const deletedExpenses    = expenseResult.deletedCount;
    const deletedSettlements = settlementResult.deletedCount;

    // 7. Fire-and-forget: audit log
    logAction({
      action:    "group.admin_deleted",
      actorId:   session!.userId,
      actorName: session!.name,
      resourceId,
      before: {
        name:            groupName,
        memberCount,
        expenseCount,
        settlementCount,
      },
      after: { reason: reason.trim() },
    }).catch((err) =>
      logError("[admin delete group] logAction", err, { groupId })
    );

    // 8. Fire-and-forget: notify every member
    for (const member of members) {
      const userId = member.userId;
      if (!userId) continue;
      notify({
        userId,
        type:      "group_deleted",
        title:     "Group deleted by admin",
        body:      `The group "${groupName}" has been deleted by an admin.`,
        resourceId,
      }).catch((err) =>
        logError("[admin delete group] notify", err, { groupId, userId })
      );
      if (member.email) {
        sendEmail({
          to: member.email,
          subject: `Your group "${groupName}" has been deleted`,
          react: GroupDeletedEmail({
            name: member.name,
            groupName,
            reason: reason.trim(),
            supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
          }),
          userId,
          prefsKey: "groupDeleted",
        }).catch((err) =>
          logError("[admin delete group] sendEmail", err, { groupId, userId })
        );
      }
    }

    // 9. Return success
    return NextResponse.json({ success: true, deletedExpenses, deletedSettlements });
  } catch (err) {
    logError("[admin delete group]", err, { groupId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
