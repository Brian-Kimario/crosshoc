import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { hashPassword, signToken, errorResponse, successResponse, setTokenCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { name, email, password } = await request.json();

    // Validation
    if (!name || !email || !password) {
      return errorResponse('Name, email, and password are required', 400);
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse('Email already registered', 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Sign JWT token
    const token = signToken(newUser._id.toString());

    // Create response and set cookie
    const response = successResponse(
      {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      201
    );

    // Set token in httpOnly cookie
    response.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Register error:', error);
    return errorResponse(error.message || 'Registration failed', 500);
  }
}
