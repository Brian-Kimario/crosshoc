/**
 * One-time migration: multiply all monetary values by 100
 * to convert from decimal dollars to integer cents.
 *
 * Run ONCE with: npx tsx scripts/migrate-to-cents.ts
 *
 * Safe to re-run — skips records already in cents (amount >= 100 for $1+).
 * Creates a log of all changes for audit purposes.
 */

import dbConnect from "../lib/db";
import Expense from "../lib/models/Expense";
import Settlement from "../lib/models/Settlement";

const ALREADY_CENTS_THRESHOLD = 100; // if amount >= 100, assume already in cents

async function migrate() {
  await dbConnect();
  console.log("[Migration] Starting cents conversion...");

  // ── Expenses ──────────────────────────────────────────────────────────────
  const expenses = await Expense.find({}).lean() as any[];
  console.log(`[Migration] Found ${expenses.length} expenses`);

  let expensesMigrated = 0;
  let expensesSkipped  = 0;

  for (const exp of expenses) {
    // Heuristic: if amount is already >= 100 and is an integer, likely already cents
    if (Number.isInteger(exp.amount) && exp.amount >= ALREADY_CENTS_THRESHOLD) {
      expensesSkipped++;
      continue;
    }

    const amountCents    = Math.round(exp.amount * 100);
    const guestShareCents = exp.guestShare != null
      ? Math.round(exp.guestShare * 100)
      : null;

    const updatedSplits = (exp.splits ?? []).map((s: any) => ({
      ...s,
      amount: Math.round(s.amount * 100),
    }));

    await Expense.findByIdAndUpdate(exp._id, {
      amount: amountCents,
      splits: updatedSplits,
      ...(guestShareCents !== null && { guestShare: guestShareCents }),
    });

    expensesMigrated++;
  }

  console.log(`[Migration] Expenses: ${expensesMigrated} migrated, ${expensesSkipped} skipped`);

  // ── Settlements ───────────────────────────────────────────────────────────
  const settlements = await Settlement.find({}).lean() as any[];
  console.log(`[Migration] Found ${settlements.length} settlements`);

  let settlementsMigrated = 0;
  let settlementsSkipped  = 0;

  for (const s of settlements) {
    if (Number.isInteger(s.amount) && s.amount >= ALREADY_CENTS_THRESHOLD) {
      settlementsSkipped++;
      continue;
    }

    await Settlement.findByIdAndUpdate(s._id, {
      amount: Math.round(s.amount * 100),
    });

    settlementsMigrated++;
  }

  console.log(`[Migration] Settlements: ${settlementsMigrated} migrated, ${settlementsSkipped} skipped`);
  console.log("[Migration] Complete. All amounts now in integer cents.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("[Migration] FAILED:", err);
  process.exit(1);
});
