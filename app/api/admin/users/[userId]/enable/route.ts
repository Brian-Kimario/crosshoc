import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { AccountReEnabledEmail } from "@/emails/AccountReEnabledEmail";

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
    // 3. Fetch the user
    const user = await User.findById(userId).select("name email isDisabled");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 4. Re-enable the user
    await User.findByIdAndUpdate(userId, { $set: { isDisabled: false } });

    // 5. Fire-and-forget: send AccountReEnabledEmail (security-critical, no prefsKey)
    const dashboardUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/";

    void sendEmail({
      to: user.email,
      subject: "Your SplitEasy account has been re-enabled",
      react: AccountReEnabledEmail({
        name: user.name,
        dashboardUrl,
      }),
    });

    // 6. Fire-and-forget: audit log
    logAction({
      action: "user.enable",
      actorId: session.userId,
      actorName: session.name,
      resourceId: userId,
      after: { email: user.email, isDisabled: false },
    }).catch((err) => logError("[admin enable user] logAction", err, { userId }));

    return NextResponse.json({ success: true });
  } catch (err) {
    logError("[admin enable user]", err, { userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
