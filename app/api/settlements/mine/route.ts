import { NextRequest } from "next/server";
import mongoose from "mongoose";

import { errorResponse, successResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import { logError } from "@/lib/logger";

const PAGE_LIMIT = 20;

/**
 * GET /api/settlements/mine
 * Returns settlements the current user is involved in.
 *
 * Query params:
 *   tab      — "needs-action" | "pending" | "history"  (default: "needs-action")
 *   groupId  — filter to a single group
 *   page     — 1-based (default 1)
 *
 * Tab semantics:
 *   needs-action  toUser = me  AND status = pending   (I need to confirm/dispute)
 *   pending       fromUser = me AND status = pending  (I submitted, waiting)
 *   history       either party AND status IN [confirmed, disputed]
 */
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { searchParams } = request.nextUrl;
    const tab     = searchParams.get("tab") ?? "needs-action";
    const groupId = searchParams.get("groupId");
    const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

    const userObjectId = new mongoose.Types.ObjectId(userId);

    let query: Record<string, unknown> = {};

    if (tab === "needs-action") {
      query = { toUser: userObjectId, status: "pending" };
    } else if (tab === "pending") {
      query = { fromUser: userObjectId, status: "pending" };
    } else {
      // history — confirmed or disputed, either party
      query = {
        $or: [{ fromUser: userObjectId }, { toUser: userObjectId }],
        status: { $in: ["confirmed", "disputed"] },
      };
    }

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      query.group = new mongoose.Types.ObjectId(groupId);
    }

    const [settlements, total] = await Promise.all([
      Settlement.find(query)
        .select(
          "fromUser toUser amount method note status idempotencyKey proofUrl settledAt confirmedAt disputeReason group createdAt"
        )
        .populate("fromUser", "name email avatarUrl")
        .populate("toUser", "name email avatarUrl")
        .populate("group", "name currency")
        .sort({ settledAt: -1 })
        .skip((page - 1) * PAGE_LIMIT)
        .limit(PAGE_LIMIT)
        .lean(),
      Settlement.countDocuments(query),
    ]);

    // Annotate with current user's role
    const annotated = settlements.map((s: any) => {
      const fromId = s.fromUser?._id?.toString();
      const toId   = s.toUser?._id?.toString();
      const role: "payer" | "creditor" | "observer" =
        fromId === userId ? "payer" :
        toId   === userId ? "creditor" : "observer";

      // Cancel eligibility: payer + pending + created < 1h ago
      const ageMs = Date.now() - new Date(s.createdAt ?? s.settledAt).getTime();
      const canCancel = role === "payer" && s.status === "pending" && ageMs < 60 * 60 * 1000;

      return {
        _id:           s._id,
        amount:        s.amount,
        method:        s.method,
        note:          s.note,
        status:        s.status,
        proofUrl:      s.proofUrl,
        settledAt:     s.settledAt,
        confirmedAt:   s.confirmedAt,
        disputeReason: s.disputeReason,
        createdAt:     s.createdAt,
        group: {
          _id:      s.group?._id,
          name:     s.group?.name ?? "Unknown group",
          currency: s.group?.currency ?? "USD",
        },
        fromUser: s.fromUser
          ? { _id: s.fromUser._id, name: s.fromUser.name, avatarUrl: s.fromUser.avatarUrl ?? null }
          : null,
        toUser: s.toUser
          ? { _id: s.toUser._id, name: s.toUser.name, avatarUrl: s.toUser.avatarUrl ?? null }
          : null,
        role,
        canCancel,
      };
    });

    // Count for badge on needs-action tab
    const needsActionCount = await Settlement.countDocuments({
      toUser: userObjectId,
      status: "pending",
    });

    return successResponse({
      settlements: annotated,
      needsActionCount,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / PAGE_LIMIT),
        hasMore: page * PAGE_LIMIT < total,
      },
    });
  } catch (err) {
    logError('[settlements mine GET]', err);
    return errorResponse("Failed to fetch settlements", 500);
  }
}
