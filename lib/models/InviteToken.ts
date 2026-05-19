import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInviteToken extends Document {
  token: string;
  groupId: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  multiUse: boolean;
  expiringSoonEmailSentAt?: Date | null;
}

const InviteTokenSchema: Schema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  multiUse: {
    type: Boolean,
    default: true,
  },
  expiringSoonEmailSentAt: {
    type: Date,
    default: null,
    index: true,
  },
});

export default mongoose.models.InviteToken ||
  mongoose.model<IInviteToken>("InviteToken", InviteTokenSchema);
