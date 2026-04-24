import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGuestSession extends Document {
  guestId: string;
  displayName: string;
  groupId: Types.ObjectId;
  inviteToken: string;
  activatedAt: Date;
  expiresAt: Date;
  claimedByUserId?: Types.ObjectId;
}

const GuestSessionSchema: Schema = new Schema({
  guestId: {
    type: String,
    required: true,
    index: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  inviteToken: {
    type: String,
    required: true,
  },
  activatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  claimedByUserId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

// Compound index for efficient lookups
GuestSessionSchema.index({ guestId: 1, groupId: 1 });
GuestSessionSchema.index({ expiresAt: 1 });

export default mongoose.models.GuestSession ||
  mongoose.model<IGuestSession>("GuestSession", GuestSessionSchema);
