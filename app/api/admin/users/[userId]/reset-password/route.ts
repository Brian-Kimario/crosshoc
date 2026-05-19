import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { AdminTriggeredResetEmail } from "@/emails/AdminTriggeredResetEmail";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error || !session) return error ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. DB connection
  await dbConnect();

  const { userId } = await params;

  try {
    // 3. Fetch the user (select password reset fields)
    const user = await User.findById(userId).select(
      "+passwordResetToken +passwordResetExpires"
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. Generate raw token and SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 5. Store hash on user with 1-hour expiry
    user.passwordResetToken = hash;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    // 6. Save user
    await user.save();

    // 7. Fire-and-forget: send AdminTriggeredResetEmail (security-critical, no prefsKey)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    void sendEmail({
      to: user.email,
      subject: "Password reset initiated by an administrator",
      react: AdminTriggeredResetEmail({
        name: user.name,
        resetUrl,
        expiresInMinutes: 60,
        supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
      }),
    });

    // 8. Fire-and-forget: audit log
    logAction({
      action: "user.admin_password_reset_triggered",
      actorId: session.userId,
      actorName: session.name,
      resourceId: userId,
      after: { email: user.email },
    }).catch((err) =>
      logError("[admin reset-password] logAction", err, { userId })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("[admin reset-password]", err, { userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
