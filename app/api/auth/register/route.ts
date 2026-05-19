import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Expense from '@/lib/models/Expense';
import { hashPassword, signToken, errorResponse, successResponse } from '@/lib/auth';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { parseBody, RegisterSchema } from '@/lib/validations';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';
import { WelcomeEmail } from '@/emails/WelcomeEmail';

export async function POST(request: NextRequest) {
  // 1. Rate limit check — must be first
  const rateLimitResult = await checkRateLimit(request, 'auth');
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult);
  }

  try {
    await dbConnect();

    // 2. Zod validation — replaces manual field checks
    const parsed = parseBody(RegisterSchema, await request.json());
    if (!parsed.success) {
      return parsed.response;
    }
    const { name, email, password, guestId } = parsed.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) return errorResponse('Email already registered', 409);

    const hashedPassword = await hashPassword(password);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    // Send welcome email (fire-and-forget, no prefsKey — always sent)
    void sendEmail({
      to: email,
      subject: 'Welcome to SplitEasy!',
      react: WelcomeEmail({
        name: newUser.name,
        dashboardUrl: (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') + '/',
      }),
    });

    // Migrate guest expenses if guestId provided
    if (guestId && typeof guestId === 'string') {
      try {
        const newUserId = newUser._id.toString();
        const guestExpenses = await Expense.find({ guestId, isGuest: true });
        for (const expense of guestExpenses) {
          expense.paidBy = newUserId as any;
          expense.createdBy = newUserId as any;
          expense.isGuest = false;
          expense.guestId = undefined;
          expense.guestName = undefined;
          await expense.save();
        }
      } catch (claimErr) {
        logError('[register route] guest claim', claimErr);
        // Non-fatal
      }
    }

    // 3. Pass tokenVersion (defaults to 0 on creation)
    const token = signToken(newUser._id.toString(), newUser.tokenVersion);

    const response = successResponse(
      { user: { id: newUser._id, name: newUser.name, email: newUser.email } },
      201
    );

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
    // 4. Structured logging; 5. Generic error message (no raw error.message)
    logError('[register route]', error);
    return errorResponse('Registration failed', 500);
  }
}
