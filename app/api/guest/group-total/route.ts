import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";

/**
 * GET /api/guest/group-total?groupId=...&token=...
 * Returns the total amount spent across ALL expenses in a group (including guest ones).
 * Authenticated via invite token — no user session required.
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = request.nextUrl;
    const groupId = searchParams.get("groupId");
    const token = searchParams.get("token");

    if (!groupId || !token) {
      return errorResponse("groupId and token are required", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Invalid groupId", 400);
    }

    // Validate token + expiry
    const group = await Group.findOne({ _id: groupId, inviteToken: token }).select("inviteExpiresAt");
    if (!group) return errorResponse("Invalid invite token", 403);
    if (group.inviteExpiresAt && new Date(group.inviteExpiresAt).getTime() < Date.now()) {
      return errorResponse("Invite link has expired", 410);
    }

    // Aggregate total — includes both regular and guest expenses
    const result = await Expense.aggregate([
      { $match: { group: new mongoose.Types.ObjectId(groupId) } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const total = result[0]?.total ?? 0;
    const count = result[0]?.count ?? 0;

    return successResponse({ total, count });
  } catch {
    return errorResponse("Failed to fetch group total", 500);
  }
}
