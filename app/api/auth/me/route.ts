import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { verifyAuth, unauthorizedResponse, successResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const user = await User.findById(userId);
    if (!user) {
      return unauthorizedResponse();
    }

    return successResponse({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Me endpoint error:', error);
    return unauthorizedResponse();
  }
}
