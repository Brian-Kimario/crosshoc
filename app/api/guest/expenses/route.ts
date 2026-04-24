import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * POST /api/guest/expenses
 * Creates an expense on behalf of a guest (no auth required).
 * Validated via invite token. Expense is split equally among all group members.
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

    // Validate invite token + expiry
    const group = await Group.findOne({ _id: groupId, inviteToken: token }).select(
      "members inviteExpiresAt"
    );
    if (!group) return errorResponse("Invalid invite token for this group", 403);
    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invite link has expired", 410);
    }

    const roundedAmount = roundToCents(parsedAmount);
    const memberIds: string[] = group.members.map(
      (m: { user: mongoose.Types.ObjectId }) => String(m.user)
    );

    // Total participants = registered members + the guest themselves
    // The guest is not in the members array, so we add 1 for them.
    const totalParticipants = memberIds.length + 1;

    // Equal split: every participant (members + guest) owes the same share
    const base = Math.floor((roundedAmount * 100) / totalParticipants);
    const remainder = Math.round(roundedAmount * 100) - base * totalParticipants;

    // Assign penny-rounding to members first; the last slot is the guest's share
    const splits = memberIds.map((memberId, index) => ({
      user: memberId,
      amount: roundToCents((base + (index < remainder ? 1 : 0)) / 100),
    }));

    // Guest's own share (the last slot in the penny-rounding sequence)
    const guestShare = roundToCents(
      (base + (memberIds.length < remainder ? 1 : 0)) / 100
    );

    const firstMemberId = memberIds[0];

    const expense = await Expense.create({
      group: groupId,
      description: description.trim(),
      amount: roundedAmount,
      category: category || "other",
      splitType: "equal",
      paidBy: firstMemberId,
      createdBy: firstMemberId,
      splits,
      isGuest: true,
      guestId,
      guestName,
      guestShare, // guest's own portion — used by balance engine
    });

    return successResponse(
      {
        expense: {
          _id: expense._id,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          isGuest: expense.isGuest,
          guestName: expense.guestName,
          guestShare: (expense as any).guestShare,
          createdAt: expense.createdAt,
        },
      },
      201
    );
  } catch (err) {
    console.error("Guest expense error:", err);
    return errorResponse("Failed to create guest expense", 500);
  }
}

/**
 * GET /api/guest/expenses?groupId=...&token=...&guestId=...
 * Returns all guest expenses for a given guestId in a group.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = request.nextUrl;
    const groupId = searchParams.get("groupId");
    const token = searchParams.get("token");
    const guestId = searchParams.get("guestId");

    if (!groupId || !token || !guestId) {
      return errorResponse("groupId, token, and guestId are required", 400);
    }

    const group = await Group.findOne({ _id: groupId, inviteToken: token }).select("inviteExpiresAt");
    if (!group) return errorResponse("Invalid invite token", 403);
    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invite link has expired", 410);
    }

    const expenses = await Expense.find({ group: groupId, guestId }).sort({ createdAt: -1 }).lean();

    return successResponse({ expenses });
  } catch {
    return errorResponse("Failed to fetch guest expenses", 500);
  }
}
