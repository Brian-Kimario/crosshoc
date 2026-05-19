import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";

/**
 * GET /api/admin/invites
 * Returns invite token data from the Group model.
 * Groups store inviteToken + inviteExpiresAt directly.
 *
 * filter: "active" | "expired" | "all"
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "active";
  const now    = new Date();

  const query: Record<string, unknown> = {
    inviteToken: { $ne: null },
  };

  if (filter === "active") {
    query.inviteExpiresAt = { $gt: now };
  } else if (filter === "expired") {
    query.inviteExpiresAt = { $lte: now };
  }

  const groups = await Group.find(query)
    .select("name inviteToken inviteExpiresAt currency creator createdAt")
    .populate("creator", "name email")
    .sort({ inviteExpiresAt: -1 })
    .limit(100)
    .lean();

  const tokens = groups.map((g: any) => ({
    _id:          g._id.toString(),
    groupId:      g._id.toString(),
    groupName:    g.name,
    token:        g.inviteToken,
    expiresAt:    g.inviteExpiresAt,
    isExpired:    g.inviteExpiresAt ? new Date(g.inviteExpiresAt) < now : false,
    createdBy:    g.creator ? { name: g.creator.name, email: g.creator.email } : null,
    createdAt:    g.createdAt,
  }));

  return NextResponse.json({ tokens });
}

/**
 * DELETE /api/admin/invites
 * Revokes an invite token by clearing it from the group.
 * Body: { groupId: string }
 */
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await req.json();
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  await dbConnect();
  await Group.findByIdAndUpdate(groupId, {
    $set: { inviteToken: null, inviteExpiresAt: null },
  });

  return NextResponse.json({ success: true });
}
