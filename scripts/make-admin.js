#!/usr/bin/env node
/**
 * Promote user to admin - JavaScript version (no TypeScript compilation needed)
 * 
 * Usage:
 *   node scripts/make-admin.js kimario.brian.89@gmail.com
 */

const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.substring(0, eq).trim();
    let val = trimmed.substring(eq + 1).trim();
    val = val.replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DB_CONNECTION_STRING;

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env.local');
  console.error('Please add your MongoDB connection string to .env.local:');
  console.error('MONGODB_URI=mongodb+srv://...');
  process.exit(1);
}

const email = process.argv[2] || 'kimario.brian.89@gmail.com';

if (!email) {
  console.error('❌ Error: Please provide an email');
  console.error('Usage: node scripts/make-admin.js user@example.com');
  process.exit(1);
}

async function main() {
  const mongoose = require('mongoose');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
    
    const result = await mongoose.connection.collection('users').findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { isAdmin: true } },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      console.error(`❌ No user found with email: ${email}`);
      console.log('Make sure you:');
      console.log('1. Created an account on the website first');
      console.log('2. Used the correct email address');
      process.exit(1);
    }
    
    console.log(`✅ Success! ${email} is now an admin`);
    console.log(`User: ${result.name || result.email}`);
    console.log(`isAdmin: ${result.isAdmin}`);
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
