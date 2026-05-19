import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import dbConnect from "@/lib/db";
import ExchangeRate from "@/lib/models/ExchangeRate";

/**
 * GET /api/admin/exchange-rates
 * Returns all stored ExchangeRate records.
 * Requires system-level admin role (isAdmin === true on User).
 *
 * Requirements: 17.1, 17.3
 */
export async function GET(_req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  await dbConnect();

  const exchangeRates = await ExchangeRate.find({})
    .sort({ base: 1, target: 1 })
    .lean();

  return NextResponse.json({ exchangeRates });
}

/**
 * POST /api/admin/exchange-rates
 * Upserts an ExchangeRate record for the given { base, target } pair.
 * Body: { base: string; target: string; rate: number }
 * Returns 200 with { exchangeRate } on success.
 * Returns 400 if rate is not a positive number.
 * Returns 403 if the requesting user is not a system admin.
 *
 * Requirements: 17.2, 17.3, 17.4
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { base?: unknown; target?: unknown; rate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { base, target, rate } = body;

  // Validate rate is a positive number
  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    return NextResponse.json(
      { error: "rate must be a positive number" },
      { status: 400 }
    );
  }

  if (!base || typeof base !== "string" || base.trim() === "") {
    return NextResponse.json(
      { error: "base currency code is required" },
      { status: 400 }
    );
  }

  if (!target || typeof target !== "string" || target.trim() === "") {
    return NextResponse.json(
      { error: "target currency code is required" },
      { status: 400 }
    );
  }

  await dbConnect();

  // Upsert: find by { base, target } and update, or create if not found
  const exchangeRate = await ExchangeRate.findOneAndUpdate(
    {
      base: base.trim().toUpperCase(),
      target: target.trim().toUpperCase(),
    },
    {
      $set: {
        rate,
        source: "manual",
        fetchedAt: new Date(),
      },
    },
    {
      new: true,       // return the updated document
      upsert: true,    // create if not found
      runValidators: true,
    }
  ).lean();

  return NextResponse.json({ exchangeRate }, { status: 200 });
}
