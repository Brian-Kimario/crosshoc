import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { PasswordChangedEmail } from '@/emails/PasswordChangedEmail';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse token and password from request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const token =
      body && typeof body === 'object' && 'token' in body
        ? (body as Record<string, unknown>).token
        : undefined;

    const password =
      body && typeof body === 'object' && 'password' in body
        ? (body as Record<string, unknown>).password
        : undefined;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 });
    }

    // 2. Hash submitted token with SHA-256
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    await dbConnect();

    // 3. Find user where passwordResetToken === hash AND passwordResetExpires > Date.now()
    const user = await User.findOne({
      passwordResetToken: hash,
      passwordResetExpires: { $gt: new Date(Date.now()) },
    }).select('+passwordResetToken +passwordResetExpires +password');

    // 4. If not found → return 400 with generic message
    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired reset token.' }, { status: 400 });
    }

    // 5. Hash new password
    const newHash = await hashPassword(password);

    // 6. Update user fields
    user.password = newHash;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
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
    return NextResponse.json({ message: 'Password reset successfully.' }, { status: 200 });
  } catch (error: unknown) {
    console.error('[reset-password route]', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
