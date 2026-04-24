import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGuestSettlement extends Document {
  group: Types.ObjectId;
  fromUser: Types.ObjectId | null;  // registered member who is paying (null if guest pays)
  toUser: Types.ObjectId | null;   // registered member receiving payment (null if member pays guest)
  guestId: string;                  // the guest's cookie-based ID
  guestName: string;               // display name for the guest
  direction: "member_to_guest" | "guest_to_member";
  amount: number;
  note?: string;
  settledAt: Date;
  createdAt: Date;
}

const GuestSettlementSchema = new Schema<IGuestSettlement>(
  {
    group: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    toUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestId: {
      type: String,
      required: true,
      index: true,
    },
    guestName: {
      type: String,
      required: true,
    },
    direction: {
      type: String,
      enum: ["member_to_guest", "guest_to_member"],
      default: "member_to_guest",
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    note: {
      type: String,
      maxlength: 200,
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

GuestSettlementSchema.index({ group: 1, guestId: 1 });
GuestSettlementSchema.index({ group: 1, toUser: 1 });

export default mongoose.models.GuestSettlement ||
  mongoose.model<IGuestSettlement>("GuestSettlement", GuestSettlementSchema);
