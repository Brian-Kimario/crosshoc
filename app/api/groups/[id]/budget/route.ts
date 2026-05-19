import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import {
  verifyAuth,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

// ─── Zod schema ───────────────────────────────────────────────────────────────

const BudgetPutSchema = z.object({
  limitCents: z
    .number({ message: "limitCents is required" })
    .int("limitCents must be an integer")
    .min(1, "limitCents must be at least 1"),
  period: z.enum(["monthly", "per-trip", "total"], {
    message: "period is required",
  }),
  alertAt: z
    .number({ message: "alertAt is required" })
    .int("alertAt must be an integer")
    .min(50, "alertAt must be at least 50")
    .max(100, "alertAt must be at most 100")
    .default(80),
});

// ─── PUT /api/groups/[id]/budget ──────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    // Auth
    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    // Rate limit
    const rateLimitResult = await checkRateLimit(request, "mutation");
    if (!rateLimitResult.success)
      return rateLimitExceededResponse(rateLimitResult);

    // Validate group id
    const { id: groupId } = await params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Invalid group id", 400);
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const parsed = BudgetPutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { limitCents, period, alertAt } = parsed.data;

    // Fetch group to check membership
    const group = await Group.findById(groupId).lean<{
      _id: mongoose.Types.ObjectId;
      members: Array<{ user: mongoose.Types.ObjectId }>;
      currency: string;
    }>();

    if (!group) return errorResponse("Group not found", 404);

    // Membership check
    const isMember = group.members.some(
      (m) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Persist budget sub-document; reset alertSentAt to null
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      {
        $set: {
          "budget.limitCents": limitCents,
          "budget.currency": group.currency ?? "USD",
          "budget.period": period,
          "budget.alertAt": alertAt,
          "budget.alertSentAt": null,
          "budget.createdAt": new Date(),
        },
      },
      { new: true, runValidators: true }
    ).lean<{
      budget: {
        limitCents: number;
        currency: string;
        period: string;
        alertAt: number;
        alertSentAt: Date | null;
        createdAt: Date;
      };
    }>();

    if (!updatedGroup) return errorResponse("Group not found", 404);

    return NextResponse.json(
      { success: true, budget: updatedGroup.budget },
      { status: 200 }
    );
  } catch (error) {
    console.error("[budget PUT]", error);
    return errorResponse("Internal server error", 500);
  }
}

// ─── DELETE /api/groups/[id]/budget ──────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    // Auth
    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    // Rate limit
    const rateLimitResult = await checkRateLimit(request, "mutation");
    if (!rateLimitResult.success)
      return rateLimitExceededResponse(rateLimitResult);

    // Validate group id
    const { id: groupId } = await params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Invalid group id", 400);
    }

    // Fetch group to check membership
    const group = await Group.findById(groupId).lean<{
      _id: mongoose.Types.ObjectId;
      members: Array<{ user: mongoose.Types.ObjectId }>;
    }>();

    if (!group) return errorResponse("Group not found", 404);

    // Membership check
    const isMember = group.members.some(
      (m) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Remove budget sub-document
    await Group.findByIdAndUpdate(groupId, { $unset: { budget: "" } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[budget DELETE]", error);
    return errorResponse("Internal server error", 500);
  }
}
