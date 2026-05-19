import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import Settlement from "@/lib/models/Settlement";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const disputed = await Settlement.find({ status: "disputed" })
    .populate("fromUser", "name email")
    .populate("toUser",   "name email")
    .populate("group",    "name currency")
    .lean()
    .sort({ createdAt: -1 });

  return NextResponse.json({ disputes: disputed });
}
