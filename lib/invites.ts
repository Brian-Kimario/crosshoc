import crypto from "crypto";
import dbConnect from "./db";
import InviteToken from "./models/InviteToken";
import mongoose from "mongoose";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createInviteToken(
  groupId: string,
  createdBy: string,
  multiUse = true
): Promise<string> {
  await dbConnect();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours

  await InviteToken.create({
    token,
    groupId: new mongoose.Types.ObjectId(groupId),
    createdBy: new mongoose.Types.ObjectId(createdBy),
    createdAt: now,
    expiresAt,
    multiUse,
  });

  return token;
}

export async function validateInviteToken(token: string): Promise<
  | { valid: true; invite: mongoose.FlattenMaps<import("./models/InviteToken").IInviteToken> }
  | { valid: false; reason: "NOT_FOUND" | "EXPIRED" | "USED" }
> {
  await dbConnect();
  const invite = await InviteToken.findOne({ token }).lean();

  if (!invite) return { valid: false, reason: "NOT_FOUND" };
  if (invite.expiresAt < new Date()) return { valid: false, reason: "EXPIRED" };
  if (!invite.multiUse && invite.usedAt) return { valid: false, reason: "USED" };

  return { valid: true, invite };
}

export async function consumeToken(token: string): Promise<boolean> {
  await dbConnect();
  const result = await InviteToken.findOneAndUpdate(
    { token },
    { usedAt: new Date() },
    { new: true }
  );
  return !!result;
}

export function buildInviteUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  return `${base}/invite/${token}`;
}

export function getTimeRemaining(expiresAt: Date): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function getTimeColor(expiresAt: Date): "green" | "amber" | "red" {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  if (hours > 24) return "green";
  if (hours > 6) return "amber";
  return "red";
}
