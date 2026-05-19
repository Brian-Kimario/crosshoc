import mongoose, { Schema, Document } from "mongoose";

export type SettlementStatus = "pending" | "confirmed" | "disputed" | "voided";

export interface ISettlement extends Document {
  group: mongoose.Types.ObjectId;
  fromUser: mongoose.Types.ObjectId;
  toUser: mongoose.Types.ObjectId;
  amount: number;           // integer cents
  method: "cash" | "digital" | "other";
  note?: string;
  status: SettlementStatus;
  idempotencyKey?: string;
  confirmedAt?: Date;
  disputeReason?: string;
  proofUrl?: string;
  adminNote?: string;
  resolvedByAdmin?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
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
      min: 1,                   // minimum 1 cent
      validate: {
        validator: Number.isInteger,
        message: "Settlement amount must be stored as integer cents",
      },
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
    status: {
      type: String,
      enum: ["pending", "confirmed", "disputed", "voided"],
      default: "pending",
      index: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,   // allows null for older records
      index: true,
    },
    confirmedAt: { type: Date },
    disputeReason: { type: String, maxlength: 500 },
    proofUrl: { type: String },
    adminNote: { type: String },
    resolvedByAdmin: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    settledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

SettlementSchema.index({ group: 1, status: 1 });
SettlementSchema.index({ group: 1, settledAt: -1 });
SettlementSchema.index({ fromUser: 1, status: 1 });
SettlementSchema.index({ toUser: 1, status: 1 });
SettlementSchema.index({ fromUser: 1, toUser: 1 });

export default mongoose.models.Settlement ||
  mongoose.model<ISettlement>("Settlement", SettlementSchema);
