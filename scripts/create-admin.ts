/**
 * One-time script to promote an existing user to admin.
 *
 * Usage:
 *   ADMIN_EMAIL=your@email.com npx tsx scripts/create-admin.ts
 *   or with MONGO_URI:
 *   ADMIN_EMAIL=your@email.com MONGODB_URI=your_uri npx tsx scripts/create-admin.ts
 */

import fs from "fs";
import path from "path";

// Load .env.local manually (no dotenv dependency)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

import dbConnect from "../lib/db";
import User from "../lib/models/User";

async function createAdmin() {
  await dbConnect();

  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    console.error("Error: Set ADMIN_EMAIL environment variable");
    console.error("Usage: ADMIN_EMAIL=your@email.com npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { isAdmin: true } },
    { new: true }
  );

  if (!user) {
    console.error(`Error: No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✓ Admin role granted to: ${user.email} (${user.name})`);
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
