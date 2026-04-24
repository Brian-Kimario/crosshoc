import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import User from "@/lib/models/User";
import dbConnect from "@/lib/db";

export async function GET() {
  try {
    await dbConnect();
    
    const userId = await verifyAuth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const user = await User.findById(userId).select("name email avatar");
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        name: user.name,
        email: user.email,
        avatar: user.avatar || "/avatars/default.jpg",
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
