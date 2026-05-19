import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Group from "@/lib/models/Group";
import Expense from "@/lib/models/Expense";
import Settlement from "@/lib/models/Settlement";
import {
  verifyAuth,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/auth";
import { logError } from "@/lib/logger";
import mongoose from "mongoose";

// Sensitive fields to exclude from the user profile export
const PROFILE_SELECT =
  "-password -loginAttempts -lockUntil -tokenVersion -passwordResetToken -passwordResetExpires -pendingEmailToken";

// POST /api/user/export — collect and return all user data as a downloadable JSON file
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch all user data in parallel
    const [user, groups, expenses, settlements] = await Promise.all([
      User.findById(userId).select(PROFILE_SELECT).lean(),
      Group.find({ "members.user": userObjectId }).lean(),
      Expense.find({
        $or: [
          { paidBy: userObjectId },
          { "splits.user": userObjectId },
        ],
      }).lean(),
      Settlement.find({
        $or: [
          { fromUser: userObjectId },
          { toUser: userObjectId },
        ],
      }).lean(),
    ]);

    if (!user) {
      return unauthorizedResponse();
    }

    const exportData = {
      profile: user,
      groups,
      expenses,
      settlements,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="spliteasy-export.json"',
      },
    });
  } catch (error: any) {
    logError("[user export POST]", error);
    return errorResponse("Internal server error", 500);
  }
}
