import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Settlement from "@/lib/models/Settlement";
import Group from "@/lib/models/Group";
import mongoose from "mongoose";
import { logError } from "@/lib/logger";

interface ActivityItem {
  id: string;
  type: "expense" | "settlement";
  status?: string;
  icon: string;
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  groupId: string;
  groupName: string;
  date: string;
  isMe?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const userIdStr = await verifyAuth(request);
    if (!userIdStr) {
      return NextResponse.json({ activities: [] }, { status: 401 });
    }

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(userIdStr);

    // Get user's group IDs first
    const userGroups = await Group.find({ "members.user": userId })
      .select("_id name currency")
      .lean();
    const groupIds = userGroups.map((g: any) => g._id);
    const groupMap: Record<string, { name: string; currency: string }> = {};
    userGroups.forEach((g: any) => {
      groupMap[g._id.toString()] = { name: g.name, currency: g.currency || "USD" };
    });

    // Fetch recent expenses in user's groups
    const recentExpenses = await Expense.find({
      group: { $in: groupIds },
    })
      .select("description amount paidBy group createdAt category isGuest guestName")
      .populate("paidBy", "name")
      .lean()
      .sort({ createdAt: -1 })
      .limit(8);

    // Fetch recent settlements involving user
    const recentSettlements = await Settlement.find({
      $or: [{ fromUser: userId }, { toUser: userId }],
    })
      .select("fromUser toUser amount status method group createdAt currency")
      .populate("fromUser", "name")
      .populate("toUser", "name")
      .lean()
      .sort({ createdAt: -1 })
      .limit(5);

    // Merge and sort by date
    const activities: ActivityItem[] = [];

    recentExpenses.forEach((e: any) => {
      const payerName = e.isGuest
        ? e.guestName
        : (e.paidBy as any)?.name ?? "Someone";
      const groupInfo = groupMap[e.group?.toString()] ?? { name: "Unknown", currency: "USD" };

      // Determine icon based on category or default
      let icon = "🧾";
      if (e.category) {
        const categoryIcons: Record<string, string> = {
          food: "🍽️",
          transport: "🚗",
          accommodation: "🏠",
          entertainment: "🎬",
          shopping: "🛍️",
          utilities: "💡",
          health: "🏥",
          travel: "✈️",
          other: "📝",
        };
        icon = categoryIcons[e.category.toLowerCase()] || "🧾";
      }

      activities.push({
        id: `exp-${e._id}`,
        type: "expense",
        icon,
        title: e.description || "Expense",
        subtitle: `${payerName} paid • ${groupInfo.name}`,
        amount: e.amount,
        currency: groupInfo.currency,
        groupId: e.group?.toString() || "",
        groupName: groupInfo.name,
        date: e.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    });

    recentSettlements.forEach((s: any) => {
      const fromName = (s.fromUser as any)?.name ?? "Someone";
      const toName = (s.toUser as any)?.name ?? "Someone";
      const isMe = (s.fromUser as any)?._id?.toString() === userIdStr;
      const groupInfo = groupMap[s.group?.toString()] ?? { name: "Unknown", currency: s.currency || "USD" };

      let icon = "💰";
      let title = `Payment ${s.status}`;
      if (s.status === "confirmed") {
        icon = "✅";
        title = "Payment confirmed";
      } else if (s.status === "disputed") {
        icon = "⚠️";
        title = "Payment disputed";
      } else if (s.status === "cancelled") {
        icon = "❌";
        title = "Payment cancelled";
      }

      activities.push({
        id: `set-${s._id}`,
        type: "settlement",
        status: s.status,
        icon,
        title,
        subtitle: `${fromName} → ${toName} • ${groupInfo.name}`,
        amount: s.amount,
        currency: groupInfo.currency,
        groupId: s.group?.toString() || "",
        groupName: groupInfo.name,
        date: s.createdAt?.toISOString() ?? new Date().toISOString(),
        isMe,
      });
    });

    // Sort by date descending, take top 8
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ activities: activities.slice(0, 8) });
  } catch (err) {
    logError('[activity recent GET]', err);
    return NextResponse.json({ activities: [] }, { status: 500 });
  }
}
