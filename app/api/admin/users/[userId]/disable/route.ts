import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { AccountDisabledEmail } from "@/emails/AccountDisabledEmail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. DB connection
  await dbConnect();

  const { userId } = await params;

  try {
    // 3. Parse optional body (reason)
    let body: { reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional — ignore parse errors
    }

    // 4. Fetch the user
    const user = await User.findById(userId).select("name email isDisabled");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 5. Disable the user
    await User.findByIdAndUpdate(userId, { $set: { isDisabled: true } });

    // 6. Fire-and-forget: send AccountDisabledEmail (security-critical, no prefsKey)
    void sendEmail({
      to: user.email,
      subject: "Your SplitEasy account has been disabled",
      react: AccountDisabledEmail({
        name: user.name,
        reason: body.reason,
        supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
      }),
    });

    // 7. Fire-and-forget: audit log
    logAction({
      action: "user.disable",
      actorId: session.userId,
      actorName: session.name,
      resourceId: userId,
      after: { email: user.email, isDisabled: true, reason: body.reason },
    }).catch((err) => logError("[admin disable user] logAction", err, { userId }));

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("[admin disable user]", err, { userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
