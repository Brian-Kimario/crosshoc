import mongoose from "mongoose";
import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";

type SplitType = "equal" | "percentage" | "exact";

type CustomSplit = {
  user: string;
  value: number;
};

const EPSILON = 0.01;

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeEqual(memberIds: string[], amount: number) {
  const base = Math.floor((amount * 100) / memberIds.length);
  const remainder = Math.round(amount * 100) - base * memberIds.length;

  return memberIds.map((memberId, index) => ({
    user: memberId,
    amount: roundToCents((base + (index < remainder ? 1 : 0)) / 100),
  }));
}

function normalizePercentage(
  memberIds: string[],
  customSplits: CustomSplit[],
  amount: number
) {
  if (customSplits.length !== memberIds.length) {
    throw new Error("Please provide percentages for every group member.");
  }

  const percentTotal = roundToCents(
    customSplits.reduce((sum, split) => sum + Number(split.value || 0), 0)
  );
  if (Math.abs(percentTotal - 100) > EPSILON) {
    throw new Error("Math doesn't add up! Percentages must total exactly 100.");
  }

  const perUser = new Map(customSplits.map((split) => [String(split.user), Number(split.value)]));
  return memberIds.map((memberId) => {
    if (!perUser.has(memberId)) {
      throw new Error("Every group member needs a percentage value.");
    }
    const percent = perUser.get(memberId) || 0;
    return {
      user: memberId,
      amount: roundToCents((amount * percent) / 100),
    };
  });
}

function normalizeExact(memberIds: string[], customSplits: CustomSplit[], amount: number) {
  if (customSplits.length !== memberIds.length) {
    throw new Error("Please provide exact amounts for every group member.");
  }

  const total = roundToCents(customSplits.reduce((sum, split) => sum + Number(split.value || 0), 0));
  if (Math.abs(total - amount) > EPSILON) {
    throw new Error(`Math doesn't add up! Splits total ${total.toFixed(2)} for ${amount.toFixed(2)}.`);
  }

  const perUser = new Map(customSplits.map((split) => [String(split.user), Number(split.value)]));
  return memberIds.map((memberId) => {
    if (!perUser.has(memberId)) {
      throw new Error("Every group member needs an amount value.");
    }
    return {
      user: memberId,
      amount: roundToCents(perUser.get(memberId) || 0),
    };
  });
}

async function loadGroupForMember(groupId: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return null;
  }

  const group = await Group.findById(groupId).select("members");
  if (!group) {
    return null;
  }

  const isMember = group.members.some(
    (member: { user: mongoose.Types.ObjectId }) => String(member.user) === String(userId)
  );
  if (!isMember) {
    return undefined;
  }

  return group;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const groupId = String(body?.groupId || "");
    const description = String(body?.description || "").trim();
    const amount = Number(body?.amount);
    const paidBy = String(body?.paidBy || "");
    const splitType = String(body?.splitType || "equal") as SplitType;
    const category = String(body?.category || "other").trim();
    const customSplits: CustomSplit[] = Array.isArray(body?.customSplits) ? body.customSplits : [];

    if (!description) {
      return errorResponse("Description is required.", 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse("Amount must be greater than zero.", 400);
    }
    if (!["equal", "percentage", "exact"].includes(splitType)) {
      return errorResponse("splitType must be equal, percentage, or exact.", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(paidBy)) {
      return errorResponse("paidBy must be a valid user.", 400);
    }

    const group = await loadGroupForMember(groupId, authUserId);
    if (group === null) {
      return errorResponse("Group not found.", 404);
    }
    if (group === undefined) {
      return unauthorizedResponse();
    }

    const memberIds = group.members.map((member: { user: mongoose.Types.ObjectId }) => String(member.user));
    if (!memberIds.includes(paidBy)) {
      return errorResponse("paidBy must belong to the selected group.", 400);
    }

    let splits: Array<{ user: string; amount: number }> = [];
    const roundedAmount = roundToCents(amount);
    try {
      if (splitType === "equal") {
        splits = normalizeEqual(memberIds, roundedAmount);
      } else if (splitType === "percentage") {
        splits = normalizePercentage(memberIds, customSplits, roundedAmount);
      } else {
        splits = normalizeExact(memberIds, customSplits, roundedAmount);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid split input.";
      return errorResponse(message, 400);
    }

    const splitTotal = roundToCents(splits.reduce((sum, split) => sum + split.amount, 0));
    if (Math.abs(splitTotal - roundedAmount) > EPSILON) {
      return errorResponse(
        `Math doesn't add up! Splits total ${splitTotal.toFixed(2)} for ${roundedAmount.toFixed(2)}.`,
        400
      );
    }

    const expense = await Expense.create({
      group: groupId,
      description,
      amount: roundedAmount,
      category: category || "other",
      splitType,
      paidBy,
      createdBy: authUserId,
      splits,
    });

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "name email avatar")
      .populate("createdBy", "name email")
      .populate("splits.user", "name email avatar");

    return successResponse({ expense: populated }, 201);
  } catch {
    return errorResponse("Failed to create expense.", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) {
      return unauthorizedResponse();
    }

    const groupId = request.nextUrl.searchParams.get("groupId");
    if (!groupId) {
      return errorResponse("groupId query param is required.", 400);
    }

    const group = await loadGroupForMember(groupId, authUserId);
    if (group === null) {
      return errorResponse("Group not found.", 404);
    }
    if (group === undefined) {
      return unauthorizedResponse();
    }

    const expenses = await Expense.find({ group: groupId })
      .populate("paidBy", "name email avatar")
      .populate("createdBy", "name email")
      .populate("splits.user", "name email avatar")
      .sort({ createdAt: -1 });

    return successResponse({ expenses });
  } catch {
    return errorResponse("Failed to fetch expenses.", 500);
  }
}
