import mongoose, { Schema, Document, Types } from "mongoose";

export type AuditAction =
  | "expense.created"
  | "expense.edited"
  | "expense.deleted"
  | "expense.voided"
  | "settlement.created"
  | "settlement.confirmed"
  | "settlement.disputed"
  | "member.added"
  | "member.removed"
  | "group.created"
  | "group.archived"
  | "group.restored"
  | "user.disable"
  | "user.enable"
  | "user.make-admin"
  | "user.remove-admin"
  | "user.deleted"
  | "settlement.admin_resolved"
  | "expense.admin_voided"
  | "member.admin_removed"
  | "group.admin_deleted"
  | "settlement.admin_voided"
  | "user.admin_profile_updated"
  | "user.admin_password_reset_triggered";

export interface IAuditLog extends Document {
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorType: "member" | "guest";
  groupId?: Types.ObjectId;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: {
    type: String,
    enum: [
      "expense.created",
      "expense.edited",
      "expense.deleted",
      "expense.voided",
      "settlement.created",
      "settlement.confirmed",
      "settlement.disputed",
      "member.added",
      "member.removed",
      "group.created",
      "group.archived",
      "group.restored",
      "user.disable",
      "user.enable",
      "user.make-admin",
      "user.remove-admin",
      "user.deleted",
      "settlement.admin_resolved",
      "expense.admin_voided",
      "member.admin_removed",
      "group.admin_deleted",
      "settlement.admin_voided",
      "user.admin_profile_updated",
      "user.admin_password_reset_triggered",
    ],
    required: true,
    index: true,
  },
  actorId:   { type: String, required: true, index: true },
  actorName: { type: String, required: true },
  actorType: { type: String, enum: ["member", "guest"], default: "member" },
  groupId:    { type: Schema.Types.ObjectId, ref: "Group", index: true },
  resourceId: { type: String },
  before: { type: Schema.Types.Mixed },
  after:  { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Audit logs are IMMUTABLE — no updates allowed
AuditLogSchema.pre("save", function (next) {
  if (!this.isNew) {
    // @ts-ignore - Mongoose pre-save hook types
    return next(new Error("Audit logs cannot be modified"));
  }
  // @ts-ignore - Mongoose pre-save hook types
  next();
});

// Compound index for group timeline queries
AuditLogSchema.index({ groupId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
