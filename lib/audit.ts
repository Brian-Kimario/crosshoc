/**
 * Audit logging utility.
 * Wire into every expense and settlement API route.
 * Audit logging must NEVER crash the main operation.
 */

import AuditLog, { type AuditAction } from "./models/AuditLog";
import type { Types } from "mongoose";

export interface LogActionParams {
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorType?: "member" | "guest";
  groupId?: string | Types.ObjectId;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await AuditLog.create({
      action: params.action,
      actorId: params.actorId,
      actorName: params.actorName,
      actorType: params.actorType ?? "member",
      groupId: params.groupId,
      resourceId: params.resourceId,
      before: params.before,
      after: params.after,
      ipAddress: params.ipAddress,
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit logging must NEVER crash the main operation
    console.error("[Audit] Failed to log action:", params.action, err);
  }
}
