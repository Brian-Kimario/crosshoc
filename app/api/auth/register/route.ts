import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Expense from '@/lib/models/Expense';
import { hashPassword, signToken, errorResponse, successResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { name, email, password, guestId } = await request.json();

    if (!name || !email || !password) {
      return errorResponse('Name, email, and password are required', 400);
    }
    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return errorResponse('Email already registered', 409);

    const hashedPassword = await hashPassword(password);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

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
        console.error('Guest claim during register failed:', claimErr);
        // Non-fatal
      }
    }

    const token = signToken(newUser._id.toString());

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
  } catch (error: any) {
    console.error('Register error:', error);
    return errorResponse(error.message || 'Registration failed', 500);
  }
}
