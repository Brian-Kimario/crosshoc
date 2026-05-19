import { NextRequest, NextResponse } from "next/server";

import { verifyAuth, unauthorizedResponse } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";
import { logError } from "@/lib/logger";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * DELETE /api/settlements/[id]/cancel
 * Cancel your own pending settlement.
 * Only available if:
 *   - fromUser = current user
 *   - status = "pending"
 *   - created < 1 hour ago
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    const settlement = await Settlement.findById(id).select(
      "fromUser status createdAt settledAt group"
    );
    if (!settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
    }

    if (String(settlement.fromUser) !== String(userId)) {
      return NextResponse.json(
        { error: "You can only cancel your own settlements" },
        { status: 403 }
      );
    }

    if (settlement.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot cancel a ${settlement.status} settlement` },
        { status: 400 }
      );
    }

    const createdAt = settlement.createdAt ?? settlement.settledAt;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs >= ONE_HOUR_MS) {
      return NextResponse.json(
        { error: "Settlements can only be cancelled within 1 hour of creation" },
        { status: 400 }
      );
    }

    await Settlement.findByIdAndDelete(id);

    return NextResponse.json({ message: "Settlement cancelled" });
  } catch (err) {
    logError('[settlement cancel]', err);
    return NextResponse.json({ error: "Failed to cancel settlement" }, { status: 500 });
  }
}
