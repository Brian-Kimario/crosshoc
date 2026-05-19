import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { verifyAuth, comparePasswords, hashPassword } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { PasswordChangedEmail } from '@/emails/PasswordChangedEmail';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse currentPassword and newPassword from request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const currentPassword =
      body && typeof body === 'object' && 'currentPassword' in body
        ? (body as Record<string, unknown>).currentPassword
        : undefined;

    const newPassword =
      body && typeof body === 'object' && 'newPassword' in body
        ? (body as Record<string, unknown>).newPassword
        : undefined;

    if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
      return NextResponse.json(
        { success: false, error: 'currentPassword and newPassword are required' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || !newPassword.trim()) {
      return NextResponse.json(
        { success: false, error: 'currentPassword and newPassword are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // 3. Fetch user with password selected
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // 4. Verify current password
    const isMatch = await comparePasswords(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // 5. Hash new password
    const newHash = await hashPassword(newPassword);

    // 6. Update user
    user.password = newHash;
    user.tokenVersion += 1;

    // 7. Save user
    await user.save();

    // 8. Fire-and-forget PasswordChangedEmail (no prefsKey — security-critical)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const supportEmail = process.env.SUPPORT_EMAIL ?? 'support@spliteasy.app';

    void sendEmail({
      to: user.email,
      subject: 'Your SplitEasy password has been changed',
      react: PasswordChangedEmail({
        name: user.name,
        settingsUrl: `${appUrl}/settings`,
        supportEmail,
      }),
    });

    // 9. Return 200
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('[user password POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
