import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { errorResponse, unauthorizedResponse, verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Expense from "@/lib/models/Expense";
import Group from "@/lib/models/Group";

/** Escape a CSV cell value — wrap in quotes and escape internal quotes */
function csvCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  // Escape double-quotes by doubling them, then wrap in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * GET /api/groups/[id]/export-csv
 * Streams a CSV file of all expenses in the group.
 * Columns: Date, Description, Category, Payer, Total Amount, Split Type, Split Breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();

    const userId = await verifyAuth(request);
    if (!userId) return unauthorizedResponse();

    const { id: groupId } = await params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return errorResponse("Invalid group id", 400);
    }

    const group = await Group.findById(groupId).select("name members currency");
    if (!group) return errorResponse("Group not found", 404);

    const isMember = group.members.some(
      (m: { user: mongoose.Types.ObjectId }) => String(m.user) === String(userId)
    );
    if (!isMember) return errorResponse("Not a member of this group", 403);

    const expenses = await Expense.find({ group: groupId })
      .populate("paidBy", "name email")
      .populate("splits.user", "name email")
      .sort({ createdAt: 1 })
      .lean();

    // ── Build CSV ──────────────────────────────────────────────────────────
    const currency: string = (group as any).currency || "USD";

    const header = [
      "Date",
      "Description",
      "Category",
      "Paid By",
      "Total Amount",
      "Currency",
      "Split Type",
      "Split Breakdown",
      "Is Guest Expense",
      "Guest Name",
    ].map(csvCell).join(",");

    const rows = expenses.map((expense: any) => {
      const date = new Date(expense.createdAt).toISOString().split("T")[0];
      const payer = expense.isGuest
        ? (expense.guestName || "Guest")
        : (expense.paidBy?.name || "Unknown");

      const splitBreakdown = expense.splits
        .map((s: any) => `${s.user?.name || "Unknown"}: ${Number(s.amount).toFixed(2)}`)
        .join(" | ");

      return [
        date,
        expense.description,
        expense.category || "other",
        payer,
        Number(expense.amount).toFixed(2),
        currency,
        expense.splitType || "equal",
        splitBreakdown,
        expense.isGuest ? "Yes" : "No",
        expense.isGuest ? (expense.guestName || "") : "",
      ].map(csvCell).join(",");
    });

    const csv = [header, ...rows].join("\r\n");

    const filename = `${group.name.replace(/[^a-z0-9]/gi, "_")}_expenses_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("CSV export error:", err);
    return errorResponse("Failed to export CSV", 500);
  }
}
