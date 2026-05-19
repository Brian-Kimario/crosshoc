/**
 * Idempotent migration: convert all existing flat `members[]` arrays to the
 * role-aware structure introduced in Phase 12 (Requirements 1.3, 1.4, 1.5).
 *
 * For each group:
 *   - The group creator receives role "owner"
 *   - All other members receive role "member"
 *   - `joinedAt` is set to the group's `createdAt` date for all migrated members
 *   - If the creator is not already in the members array, they are added as "owner"
 *   - `createdBy` is set to `creator` for backwards compatibility
 *
 * Idempotency: groups whose first member already has a `role` field are skipped.
 *
 * Run with:
 *   npx ts-node scripts/migrate-group-roles.ts
 *   or
 *   npx tsx scripts/migrate-group-roles.ts
 */

import fs from "fs";
import path from "path";

// Load .env.local manually so the script works outside Next.js context
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

import mongoose from "mongoose";
import dbConnect from "../lib/db";

// ---------------------------------------------------------------------------
// Inline raw schema — we use mongoose directly to avoid any model caching
// issues and to access the raw document shape before migration.
// ---------------------------------------------------------------------------

interface RawMember {
  user: mongoose.Types.ObjectId;
  role?: string;
  joinedAt?: Date;
}

interface RawGroup {
  _id: mongoose.Types.ObjectId;
  name: string;
  creator: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  members: RawMember[];
  createdAt: Date;
}

async function migrate(): Promise<void> {
  await dbConnect();
  console.log("[migrate-group-roles] Connected to MongoDB.");

  // Access the raw collection to avoid Mongoose schema validation during migration
  const collection = mongoose.connection.collection("groups");

  const groups = await collection.find({}).toArray() as unknown as RawGroup[];
  console.log(`[migrate-group-roles] Found ${groups.length} group(s) to inspect.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const group of groups) {
    const groupLabel = `Group "${group.name}" (${group._id})`;

    try {
      // ── Idempotency check ────────────────────────────────────────────────
      // If the first member already has a `role` field, the group is already
      // in the role-aware format — skip it.
      if (
        group.members.length > 0 &&
        group.members[0].role !== undefined &&
        group.members[0].role !== null
      ) {
        console.log(`[migrate-group-roles] SKIP  ${groupLabel} — already migrated.`);
        skipped++;
        continue;
      }

      const creatorId = group.creator;
      const joinedAt = group.createdAt ?? new Date();

      // Build a set of existing member user IDs (as strings for comparison)
      const existingUserIds = new Set(
        group.members.map((m) => m.user.toString())
      );

      // Build the new role-aware members array
      const newMembers: RawMember[] = group.members.map((m) => ({
        user: m.user,
        role: m.user.toString() === creatorId.toString() ? "owner" : "member",
        joinedAt,
      }));

      // If the creator is not already in the members array, add them as owner
      if (!existingUserIds.has(creatorId.toString())) {
        console.log(
          `[migrate-group-roles]   Creator not in members — adding as owner.`
        );
        newMembers.unshift({
          user: creatorId,
          role: "owner",
          joinedAt,
        });
      }

      // Apply the update
      await collection.updateOne(
        { _id: group._id },
        {
          $set: {
            members: newMembers,
            createdBy: creatorId,
          },
        }
      );

      console.log(
        `[migrate-group-roles] DONE  ${groupLabel} — ${newMembers.length} member(s) migrated.`
      );
      migrated++;
    } catch (err) {
      console.error(
        `[migrate-group-roles] ERROR ${groupLabel}:`,
        err instanceof Error ? err.message : err
      );
      errors++;
    }
  }

  console.log(
    `\n[migrate-group-roles] Summary: ${migrated} migrated, ${skipped} skipped, ${errors} error(s).`
  );

  if (errors > 0) {
    console.error("[migrate-group-roles] Completed with errors — review logs above.");
    process.exit(1);
  } else {
    console.log("[migrate-group-roles] Migration complete.");
    process.exit(0);
  }
}

migrate().catch((err) => {
  console.error("[migrate-group-roles] FATAL:", err);
  process.exit(1);
});
