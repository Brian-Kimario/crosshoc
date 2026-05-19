import { NextRequest, NextResponse } from 'next/server';
import { successResponse, verifyAuth, unauthorizedResponse } from '@/lib/auth';
import { logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

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
    logError('[logout POST]', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}
