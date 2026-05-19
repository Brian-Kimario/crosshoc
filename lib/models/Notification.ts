import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      "expense_added",
      "expense_edited",
      "expense_deleted",
      "settlement_made",
      "settlement_confirmed",
      "settlement_disputed",
      "member_joined",
      "guest_joined",
      "invite_expiring",
      "debt_reminder",
      "group_created",
    ],
    required: true,
  },
  title:      { type: String, required: true },
  body:       { type: String, required: true },
  groupId:    { type: Schema.Types.ObjectId, ref: "Group" },
  actorName:  { type: String },
  amount:     { type: Number },   // integer cents
  currency:   { type: String, default: "USD" },
  resourceId: { type: String },   // expenseId or settlementId
  metadata:   { type: Schema.Types.Mixed },
  read:       { type: Boolean, default: false, index: true },
  createdAt:  { type: Date, default: Date.now, index: true },
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Notification ??
  mongoose.model("Notification", NotificationSchema);

export interface INotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
  actorName?: string;
  amount?: number;
  currency?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
