import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { SAFE_USER_FIELDS } from "@/lib/sanitize";
import { sendEmail } from "@/lib/email";
import { AccountDeletedEmail } from "@/emails/AccountDeletedEmail";

/** PATCH /api/admin/users/[userId] — disable/enable or promote/demote */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  const { userId } = await params;
  const body = await req.json();
  const { action } = body;
  // action: "disable" | "enable" | "make-admin" | "remove-admin"

  const target = await User.findById(userId).select(SAFE_USER_FIELDS);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent admin from removing their own admin role
  if (action === "remove-admin" && target._id.toString() === session.userId) {
    return NextResponse.json(
      { error: "Cannot remove your own admin role" },
      { status: 400 }
    );
  }

  // Map action → DB update
  const updateMap: Record<string, Record<string, unknown>> = {
    "disable":      { isDisabled: true },
    "enable":       { isDisabled: false },
    "make-admin":   { isAdmin: true },
    "remove-admin": { isAdmin: false },
  };

  const updates = updateMap[action];
  if (!updates) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await User.findByIdAndUpdate(userId, { $set: updates });

  await logAction({
    action:     `user.${action}` as any,
    actorId:    session.userId,
    actorName:  session.name,
    resourceId: userId,
    after:      { email: target.email, action },
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/admin/users/[userId] — permanently delete a user account */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { session, error } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;

  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  // Parse optional body (reason)
  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — ignore parse errors
  }

  await dbConnect();
  const user = await User.findById(userId).select(SAFE_USER_FIELDS);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Capture email and name before deletion
  const capturedEmail = user.email as string;
  const capturedName = user.name as string;

  await User.findByIdAndDelete(userId);

  // Fire-and-forget: send AccountDeletedEmail (security-critical, no prefsKey)
  void sendEmail({
    to: capturedEmail,
    subject: "Your SplitEasy account has been deleted",
    react: AccountDeletedEmail({
      name: capturedName,
      reason: body.reason,
      supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
    }),
  });

  await logAction({
    action:    "user.deleted",
    actorId:   session.userId,
    actorName: session.name,
    resourceId: userId,
    before:    { email: capturedEmail },
  });

  return NextResponse.json({ success: true });
}
