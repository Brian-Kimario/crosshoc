import { NextRequest, NextResponse } from 'next/server';
import { successResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = successResponse({ message: 'Logged out successfully' });

    // Clear auth token cookie
    response.cookies.set('authToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // This will delete the cookie
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}
