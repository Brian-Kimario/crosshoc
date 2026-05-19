import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { ForgotPasswordEmail } from '@/emails/ForgotPasswordEmail';

const GENERIC_SUCCESS = { message: 'If that email is registered, a reset link has been sent.' };

export async function POST(request: NextRequest) {
  // 1. Rate limit check (auth preset — 5 req / 60 s)
  const rateLimitResult = await checkRateLimit(request, 'auth');
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // 2. Parse and validate email from request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const email =
      body && typeof body === 'object' && 'email' in body
        ? (body as Record<string, unknown>).email
        : undefined;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    await dbConnect();

    // 3. Look up user by email — return 200 with generic message if not found (anti-enumeration)
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      '+passwordResetToken +passwordResetExpires'
    );

    if (!user) {
      return NextResponse.json(GENERIC_SUCCESS, { status: 200 });
    }

    // 4. Generate raw token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // 5. Hash with SHA-256 for storage
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 6. Set token fields on user
    user.passwordResetToken = hash;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    // 7. Save user
    await user.save();

    // 8. Fire-and-forget email with reset link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    void sendEmail({
      to: user.email,
      subject: 'Reset your SplitEasy password',
      react: ForgotPasswordEmail({
        name: user.name,
        resetUrl,
        expiresInMinutes: 60,
      }),
    });

    // 9. Return 200 with generic success message
    return NextResponse.json(GENERIC_SUCCESS, { status: 200 });
  } catch (error: unknown) {
    console.error('[forgot-password route]', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
