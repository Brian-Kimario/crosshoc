import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Expense from '@/lib/models/Expense';
import { comparePasswords, signToken, errorResponse, successResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { email, password, guestId } = await request.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return errorResponse('Invalid email or password', 401);

    const isPasswordValid = await comparePasswords(password, user.password);
    if (!isPasswordValid) return errorResponse('Invalid email or password', 401);

    // Migrate guest expenses if guestId provided
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
        console.error('Guest claim during login failed:', claimErr);
        // Non-fatal — user still logs in
      }
    }

    const token = signToken(user._id.toString());

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
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse(error.message || 'Login failed', 500);
  }
}
