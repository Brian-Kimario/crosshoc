/**
 * Ensure all MongoDB indexes are created.
 * Run once on deploy and after schema changes:
 *   npx tsx scripts/ensure-indexes.ts
 */

import dbConnect from "../lib/db";
import Expense from "../lib/models/Expense";
import Settlement from "../lib/models/Settlement";
import Group from "../lib/models/Group";
import AuditLog from "../lib/models/AuditLog";

async function ensureIndexes() {
  await dbConnect();
  console.log("[Indexes] Creating indexes...");

  // Expense — most-queried collection
  await Expense.collection.createIndexes([
    { key: { group: 1, createdAt: -1 } },
    { key: { group: 1, "splits.user": 1 } },
    { key: { group: 1, paidBy: 1 } },
    { key: { guestId: 1 }, sparse: true },
  ] as any[]);
  console.log("[Indexes] Expense indexes done");

  // Settlement
  await Settlement.collection.createIndexes([
    { key: { group: 1, status: 1 } },
    { key: { group: 1, settledAt: -1 } },
    { key: { fromUser: 1, status: 1 } },
    { key: { toUser: 1, status: 1 } },
    { key: { idempotencyKey: 1 }, unique: true, sparse: true },
  ] as any[]);
  console.log("[Indexes] Settlement indexes done");

  // Group
  await Group.collection.createIndexes([
    { key: { "members.user": 1 } },
    { key: { creator: 1 } },
    { key: { inviteToken: 1 }, sparse: true },
  ] as any[]);
  console.log("[Indexes] Group indexes done");

  // AuditLog
  await AuditLog.collection.createIndexes([
    { key: { groupId: 1, timestamp: -1 } },
    { key: { actorId: 1, timestamp: -1 } },
    { key: { action: 1, timestamp: -1 } },
  ] as any[]);
  console.log("[Indexes] AuditLog indexes done");

  console.log("[Indexes] All indexes ensured successfully");
  process.exit(0);
}

ensureIndexes().catch((err) => {
  console.error("[Indexes] FAILED:", err);
  process.exit(1);
});
