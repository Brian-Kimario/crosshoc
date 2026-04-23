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

function normalizePercentage(memberIds: string[], customSplits: CustomSplit[], amount: number) {
  if (customSplits.length !== memberIds.length) {
    throw new Error("Please provide percentages for every group member.");
  }
  const total = roundToCents(customSplits.reduce((sum, split) => sum + Number(split.value || 0), 0));
  if (Math.abs(total - 100) > EPSILON) {
    throw new Error("Math doesn't add up! Percentages must total exactly 100.");
  }
  const perUser = new Map(customSplits.map((split) => [String(split.user), Number(split.value)]));
  return memberIds.map((memberId) => ({
    user: memberId,
    amount: roundToCents((amount * (perUser.get(memberId) || 0)) / 100),
  }));
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
  return memberIds.map((memberId) => ({
    user: memberId,
    amount: roundToCents(perUser.get(memberId) || 0),
  }));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid expense id.", 400);
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      return errorResponse("Expense not found.", 404);
    }

    if (String(expense.createdBy) !== String(authUserId)) {
      return unauthorizedResponse();
    }

    const group = await Group.findById(expense.group).select("members");
    if (!group) {
      return errorResponse("Group not found.", 404);
    }

    const memberIds = group.members.map((member: { user: mongoose.Types.ObjectId }) => String(member.user));

    const body = await request.json();
    const description = String(body?.description || expense.description).trim();
    const amount = body?.amount !== undefined ? Number(body.amount) : Number(expense.amount);
    const paidBy = body?.paidBy ? String(body.paidBy) : String(expense.paidBy);
    const splitType = (body?.splitType || expense.splitType) as SplitType;
    const category = body?.category ? String(body.category) : String(expense.category || "other");
    const customSplits: CustomSplit[] = Array.isArray(body?.customSplits) ? body.customSplits : [];

    if (!description) {
      return errorResponse("Description is required.", 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse("Amount must be greater than zero.", 400);
    }
    if (!memberIds.includes(paidBy)) {
      return errorResponse("paidBy must belong to the selected group.", 400);
    }

    const roundedAmount = roundToCents(amount);
    let splits: Array<{ user: string; amount: number }> = [];
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

    expense.description = description;
    expense.amount = roundedAmount;
    expense.paidBy = new mongoose.Types.ObjectId(paidBy);
    expense.category = category || "other";
    expense.splitType = splitType;
    expense.splits = splits.map((split) => ({
      user: new mongoose.Types.ObjectId(split.user),
      amount: split.amount,
    }));
    expense.updatedAt = new Date();
    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate("paidBy", "name email avatar")
      .populate("createdBy", "name email")
      .populate("splits.user", "name email avatar");

    return successResponse({ expense: populated });
  } catch {
    return errorResponse("Failed to update expense.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const authUserId = await verifyAuth(request);
    if (!authUserId) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid expense id.", 400);
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      return errorResponse("Expense not found.", 404);
    }

    if (String(expense.createdBy) !== String(authUserId)) {
      return unauthorizedResponse();
    }

    await Expense.findByIdAndDelete(id);
    return successResponse({ message: "Expense deleted." });
  } catch {
    return errorResponse("Failed to delete expense.", 500);
  }
}
