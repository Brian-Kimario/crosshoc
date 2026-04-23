import mongoose, { Schema, Document } from "mongoose";

export interface ISettlement extends Document {
  group: mongoose.Types.ObjectId;
  fromUser: mongoose.Types.ObjectId; // The person paying (ower)
  toUser: mongoose.Types.ObjectId; // The person receiving (owner)
  amount: number;
  method: "cash" | "digital" | "other";
  note?: string;
  settledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlement>(
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
      required: true,
    },
    toUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    method: {
      type: String,
      enum: ["cash", "digital", "other"],
      default: "cash",
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
  {
    timestamps: true,
  }
);

// Index for efficient queries
SettlementSchema.index({ group: 1, settledAt: -1 });
SettlementSchema.index({ fromUser: 1, toUser: 1 });

export default mongoose.models.Settlement || mongoose.model<ISettlement>("Settlement", SettlementSchema);
