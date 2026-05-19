import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Expense from '@/lib/models/Expense';
import { comparePasswords, signTokenWithSession, errorResponse, successResponse } from '@/lib/auth';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { parseBody, LoginSchema } from '@/lib/validations';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { NewLoginEmail } from '@/emails/NewLoginEmail';
import { AccountLockedEmail } from '@/emails/AccountLockedEmail';

// Timing-safe dummy hash used when user is not found, to prevent user enumeration
// via timing differences between "user not found" and "wrong password" paths.
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu';

export async function POST(request: NextRequest) {
  // 1. Rate limit check — must be first
  const rateLimitResult = await checkRateLimit(request, 'auth');
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    // 2. Validate request body with Zod
    const parsed = parseBody(LoginSchema, await request.json());
    if (!parsed.success) {
      return parsed.response;
    }
    const { email, password, guestId } = parsed.data;

    await dbConnect();

    // 3. Look up user by email
    const user = await User.findOne({ email }).select('+password');

    // 3a. Brute-force lockout check — before any password comparison
    if (user && user.lockUntil && user.lockUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / (60 * 1000)
      );
      return NextResponse.json(
        {
          success: false,
          error: `Account locked. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
        },
        { status: 429 }
      );
    }

    // 3b. If user not found: run dummy compare to prevent timing-based enumeration
    if (!user) {
      await comparePasswords(password, DUMMY_HASH);
      return errorResponse('Invalid email or password', 401);
    }

    // 3c. Compare password
    const isPasswordValid = await comparePasswords(password, user.password);

    if (!isPasswordValid) {
      // Increment loginAttempts; lock if threshold reached
      user.loginAttempts = (user.loginAttempts ?? 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();

      // Send AccountLockedEmail when account just got locked (security-critical — no prefsKey)
      if (user.loginAttempts >= 5 && user.lockUntil) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        void sendEmail({
          to: user.email,
          subject: 'Your SplitEasy account has been temporarily locked',
          react: AccountLockedEmail({
            name: user.name,
            lockDurationMinutes: 15,
            forgotPasswordUrl: appUrl + '/forgot-password',
          }),
        });
      }

      return errorResponse('Invalid email or password', 401);
    }

    // 3d. Successful login — reset lockout fields and record login metadata
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    const previousLoginIp = user.lastLoginIp ?? null;
    const currentIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      null;
    user.lastLoginIp = currentIp;
    await user.save();

    // Send NewLoginEmail if IP changed from a previously known IP (opt-out via prefsKey)
    if (previousLoginIp && currentIp && previousLoginIp !== currentIp) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      void sendEmail({
        to: user.email,
        subject: 'New login detected on your SplitEasy account',
        react: NewLoginEmail({
          name: user.name,
          loginAt: new Date().toUTCString(),
          ipAddress: currentIp,
          settingsUrl: appUrl + '/settings',
          supportEmail: process.env.SUPPORT_EMAIL ?? 'support@spliteasy.app',
        }),
        userId: user._id.toString(),
        prefsKey: 'newLogin',
      });
    }

    // 4. Migrate guest expenses if guestId provided
    if (guestId && typeof guestId === 'string') {
      try {
        const realUserId = user._id.toString();
        const guestExpenses = await Expense.find({ guestId, isGuest: true });
        for (const expense of guestExpenses) {
          expense.paidBy = realUserId as any;
          expense.createdBy = realUserId as any;
          expense.isGuest = false;
          expense.guestId = undefined;
          expense.guestName = undefined;
          await expense.save();
        }
      } catch (claimErr) {
        logError('[login route] guest claim', claimErr);
        // Non-fatal — user still logs in
      }
    }

    // 5. Sign token with tokenVersion and a new sessionId
    const sessionId = randomUUID();
    const token = signTokenWithSession(user._id.toString(), user.tokenVersion, sessionId);

    // 6. Push the new session record to the DB (keep newest 10 via $slice: -10)
    const currentIpForSession =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'Unknown';
    await User.findByIdAndUpdate(user._id, {
      $push: {
        sessions: {
          $each: [{
            sessionId,
            userAgent: request.headers.get('user-agent') ?? 'Unknown',
            ipAddress: currentIpForSession,
            createdAt: new Date(),
            lastSeenAt: new Date(),
          }],
          $slice: -10, // keep newest 10
        },
      },
    });

    const response = successResponse({
      user: { id: user._id, name: user.name, email: user.email },
    });

    response.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Clear guest cookies
    response.cookies.set('guestId', '', { maxAge: 0, path: '/' });
    response.cookies.set('guestName', '', { maxAge: 0, path: '/' });

    return response;
  } catch (error: unknown) {
    logError('[login route]', error);
    return errorResponse('Login failed', 500);
  }
}
