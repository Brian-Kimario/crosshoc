import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Feedback from "@/lib/models/Feedback";

/** GET /api/admin/feedback — list all feedback, optionally unread only */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const category   = searchParams.get("category"); // "bug" | "feature" | "general"

  const query: Record<string, unknown> = {};
  if (unreadOnly) query.read = false;
  if (category && ["bug", "feature", "general"].includes(category)) {
    query.category = category;
  }

  const [feedback, unreadCount] = await Promise.all([
    Feedback.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Feedback.countDocuments({ read: false }),
  ]);

  return NextResponse.json({ feedback, unreadCount });
}

/** PATCH /api/admin/feedback — mark a feedback item as read */
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await dbConnect();
  await Feedback.findByIdAndUpdate(id, { $set: { read: true } });

  return NextResponse.json({ success: true });
}
