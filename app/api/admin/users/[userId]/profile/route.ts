import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { logError } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { EmailChangedEmail } from "@/emails/EmailChangedEmail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // 1. Auth guard
  const { session, error } = await requireAdmin();
  if (error) return error;

  // 2. DB connection
  await dbConnect();

  const { userId } = await params;

  try {
    // 3. Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Provide name and/or email" }, { status: 400 });
    }

    const { name, email } = (body as Record<string, unknown>) ?? {};

    // 4. Validate: at least one field must be provided
    if (name === undefined && email === undefined) {
      return NextResponse.json({ error: "Provide name and/or email" }, { status: 400 });
    }

    // 5. Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      }
    }

    // 6. Validate email format if provided
    if (email !== undefined) {
      if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    }

    // 7. Fetch the user (exclude password)
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 8. Check for duplicate email
    if (email !== undefined) {
      const existing = await User.findOne({ email, _id: { $ne: userId } }).select("_id").lean();
      if (existing) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    // 9. Capture before state for audit log
    const before = {
      name: user.name,
      email: user.email,
    };

    // 10. Apply updates — never touch password
    const updates: Record<string, string> = {};
    if (name !== undefined) updates.name = (name as string).trim();
    if (email !== undefined) updates.email = email as string;

    await User.findByIdAndUpdate(userId, { $set: updates });

    // Fetch updated user for response
    const updatedUser = await User.findById(userId).select("_id name email").lean();

    const after = {
      name: (updatedUser as any)?.name ?? before.name,
      email: (updatedUser as any)?.email ?? before.email,
    };

    const resourceId = userId;

    // 11. Fire-and-forget: email notification when email changed (security-critical, no prefsKey)
    if (email !== undefined && email !== before.email) {
      void sendEmail({
        to: before.email,
        subject: "Your SplitEasy email address has been changed",
        react: EmailChangedEmail({
          name: user.name,
          oldEmail: before.email,
          newEmail: email as string,
          supportEmail: process.env.SUPPORT_EMAIL ?? "support@spliteasy.app",
        }),
      });
    }

    // 13. Fire-and-forget: audit log
    logAction({
      action: "user.admin_profile_updated",
      actorId: session!.userId,
      actorName: session!.name,
      resourceId,
      before,
      after,
    }).catch((err) =>
      logError("[admin update profile] logAction", err, { userId })
    );

    // 14. Fire-and-forget: notify the affected user
    notify({
      userId,
      type: "expense_edited",
      title: "Your profile was updated by an admin",
      body: "An administrator has updated your profile information.",
      resourceId,
    }).catch((err) =>
      logError("[admin update profile] notify", err, { userId })
    );

    // 15. Return success
    return NextResponse.json({
      success: true,
      user: {
        _id: (updatedUser as any)?._id?.toString() ?? userId,
        name: after.name,
        email: after.email,
      },
    });
  } catch (err) {
    logError("[admin update profile]", err, { userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
