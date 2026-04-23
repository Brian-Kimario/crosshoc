import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import Settlement from "@/lib/models/Settlement";
import mongoose from "mongoose";

// POST /api/groups/[id]/settle - Record a settlement payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await request.json();
    const { fromUserId, toUserId, amount, method = "cash", note } = body;

    // Validate required fields
    if (!fromUserId || !toUserId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: fromUserId, toUserId, amount" },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Round to 2 decimal places
    const roundedAmount = Number(amount.toFixed(2));

    await dbConnect();

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isMember = group.members.some(
      (member: { user: mongoose.Types.ObjectId }) =>
        String(member.user) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // Verify both users are group members
    const fromUserIsMember = group.members.some(
      (member: { user: mongoose.Types.ObjectId }) =>
        String(member.user) === String(fromUserId)
    );
    const toUserIsMember = group.members.some(
      (member: { user: mongoose.Types.ObjectId }) =>
        String(member.user) === String(toUserId)
    );

    if (!fromUserIsMember || !toUserIsMember) {
      return NextResponse.json(
        { error: "Both users must be members of the group" },
        { status: 400 }
      );
    }

    // Create the settlement record
    const settlement = await Settlement.create({
      group: groupId,
      fromUser: fromUserId,
      toUser: toUserId,
      amount: roundedAmount,
      method,
      note: note || undefined,
      settledAt: new Date(),
    });

    // Populate user details for response
    await settlement.populate([
      { path: "fromUser", select: "name email avatar" },
      { path: "toUser", select: "name email avatar" },
    ]);

    return NextResponse.json(
      {
        message: "Settlement recorded successfully",
        settlement: {
          _id: settlement._id,
          amount: settlement.amount,
          method: settlement.method,
          fromUser: settlement.fromUser,
          toUser: settlement.toUser,
          settledAt: settlement.settledAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Settlement error:", error);
    return NextResponse.json(
      { error: "Failed to record settlement" },
      { status: 500 }
    );
  }
}

// GET /api/groups/[id]/settle - Get all settlements for a group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await verifyAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    await dbConnect();

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isMember = group.members.some(
      (member: { user: mongoose.Types.ObjectId }) =>
        String(member.user) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // Get all settlements for the group
    const settlements = await Settlement.find({ group: groupId })
      .populate("fromUser", "name email avatar")
      .populate("toUser", "name email avatar")
      .sort({ settledAt: -1 })
      .lean();

    return NextResponse.json({ settlements });
  } catch (error) {
    console.error("Get settlements error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlements" },
      { status: 500 }
    );
  }
}
