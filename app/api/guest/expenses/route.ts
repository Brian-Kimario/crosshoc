import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";
import { toCents, distributeEvenly, fromCents } from "@/lib/money";
import { invalidateBalanceCache } from "@/lib/balance-cache";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";

/**
 * POST /api/guest/expenses
 * Creates an expense on behalf of a guest (no auth required).
 * Validated via invite token.
 *
 * Key invariant: paidBy is set to null (not a real member ID).
 * The balance engine detects isGuest=true and uses the virtual
 * guest::${guestId} key instead of any real member's ObjectId.
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { guestId, guestName, groupId, token, description, amount, category } = body;

    if (!guestId || !guestName) return errorResponse("Guest session is required", 401);
    if (!token) return errorResponse("Invite token is required", 400);
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Valid groupId is required", 400);
    }
    if (!description?.trim()) return errorResponse("Description is required", 400);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return errorResponse("Amount must be greater than zero", 400);
    }

    const group = await Group.findOne({ _id: groupId, inviteToken: token })
      .select("members inviteExpiresAt currency")
      .lean() as any;

    if (!group) return errorResponse("Invalid invite token for this group", 403);
    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invite link has expired", 410);
    }

    const currency: string = group.currency || "USD";
    const amountCents = toCents(parsedAmount, currency);

    const memberIds: string[] = group.members.map(
      (m: { user: mongoose.Types.ObjectId }) => String(m.user)
    );

    // Total participants = registered members + the guest
    const totalParticipants = memberIds.length + 1;

    // distributeEvenly: payer (guest) absorbs the remainder — index = last slot
    const allShares = distributeEvenly(amountCents, totalParticipants, memberIds.length);

    // Member splits (indices 0..n-1)
    const splits = memberIds.map((memberId, index) => ({
      user: memberId,
      amount: allShares[index],
    }));

    // Guest's own share (last slot)
    const guestShare = allShares[memberIds.length];

    const expense = await Expense.create({
      group: groupId,
      description: description.trim(),
      amount: amountCents,
      category: category || "other",
      splitType: "equal",
      paidBy: null,           // ← explicitly null — guest paid, not a real member
      createdBy: memberIds[0], // first member as technical owner for DB constraint
      splits,
      isGuest: true,
      guestId,
      guestName,
      guestShare,
      currency,
    });

    await invalidateBalanceCache(groupId);

    // Notify the group creator that a guest added an expense
    // (first expense from this guest = "guest joined" event)
    const existingGuestExpenses = await Expense.countDocuments({
      group: groupId,
      guestId,
      _id: { $ne: expense._id },
    });

    if (existingGuestExpenses === 0) {
      // First expense from this guest — fire "guest_joined"
      await notify({
        userId:    String(group.creator),
        type:      "guest_joined",
        title:     "Guest joined via link",
        body:      `${guestName} joined ${group.name} as a guest and added their first expense`,
        groupId,
        actorName: guestName,
      });
    } else {
      // Subsequent expense — notify members of the new expense
      for (const memberId of memberIds) {
        await notify({
          userId:    memberId,
          type:      "expense_added",
          title:     "New expense added",
          body:      `${guestName} (Guest) added "${description.trim()}" — your share: ${fromCents(splits.find(s => s.user === memberId)?.amount ?? 0, currency)} ${currency}`,
          groupId,
          actorName: guestName,
          amount:    splits.find(s => s.user === memberId)?.amount,
          currency,
          resourceId: String(expense._id),
        });
      }
    }

    return successResponse(
      {
        expense: {
          _id: expense._id,
          description: expense.description,
          amount: expense.amount,
          amountDisplay: fromCents(expense.amount, currency),
          category: expense.category,
          isGuest: expense.isGuest,
          guestName: expense.guestName,
          guestShare: (expense as any).guestShare,
          guestShareDisplay: fromCents((expense as any).guestShare ?? 0, currency),
          createdAt: expense.createdAt,
        },
      },
      201
    );
  } catch (err) {
    logError('[guest expenses POST]', err);
    return errorResponse("Failed to create guest expense", 500);
  }
}

/**
 * GET /api/guest/expenses?groupId=...&token=...&guestId=...
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = request.nextUrl;
    const groupId = searchParams.get("groupId");
    const token   = searchParams.get("token");
    const guestId = searchParams.get("guestId");

    if (!groupId || !token || !guestId) {
      return errorResponse("groupId, token, and guestId are required", 400);
    }

    const group = await Group.findOne({ _id: groupId, inviteToken: token })
      .select("inviteExpiresAt")
      .lean() as any;

    if (!group) return errorResponse("Invalid invite token", 403);
    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invite link has expired", 410);
    }

    const expenses = await Expense.find({ group: groupId, guestId })
      .select("description amount category guestName guestShare createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return successResponse({ expenses });
  } catch {
    return errorResponse("Failed to fetch guest expenses", 500);
  }
}
