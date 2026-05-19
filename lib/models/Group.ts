import mongoose, { Schema, Document, Types } from "mongoose";

export type GroupCurrency = "USD" | "INR" | "TZS" | "KES" | "GBP" | "EUR";

export interface CachedBalanceEntry {
  userId: string;
  userName: string;
  isGuest: boolean;
  paidCents: number;
  owedCents: number;
  balanceCents: number;
}

export interface IBudget {
  limitCents: number;           // positive integer
  currency: string;             // mirrors group currency
  period: "monthly" | "per-trip" | "total";
  alertAt: number;              // 50–100, default 80
  alertSentAt: Date | null;     // null = alert not yet sent
  createdAt: Date;
}

/** Role-aware member sub-document (Requirements 1.1) */
export interface IGroupMember {
  user: Types.ObjectId;
  role: "owner" | "admin" | "member";
  joinedAt: Date;
}

export interface IGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  creator: Types.ObjectId;
  /** Backwards-compatibility alias for `creator` (Requirements 1.2) */
  createdBy: Types.ObjectId;
  members: IGroupMember[];
  /** Group lifecycle status (Requirements 5.1) */
  status: "active" | "archived";
  /** Archive metadata (Requirements 5.2) */
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  archiveNote?: string;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  currency: GroupCurrency;
  cachedBalances?: {
    data: CachedBalanceEntry[];
    calculatedAt?: Date;
    version: number;
  };
  budget?: IBudget;
  createdAt: Date;
  updatedAt?: Date;
}

const GroupSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, "Please provide a group name"],
    trim: true,
  },
  description: {
    type: String,
    default: "",
    trim: true,
    maxlength: 300,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  /** Backwards-compatibility alias for `creator` (Requirements 1.2) */
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  members: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      role: {
        type: String,
        enum: ["owner", "admin", "member"],
        required: true,
        default: "member",
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  /** Group lifecycle status (Requirements 5.1) */
  status: {
    type: String,
    enum: ["active", "archived"],
    default: "active",
  },
  /** Archive metadata (Requirements 5.2) */
  archivedAt: {
    type: Date,
  },
  archivedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  archiveNote: {
    type: String,
  },
  inviteToken: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
    index: true,
  },
  inviteExpiresAt: {
    type: Date,
    default: null,
  },
  currency: {
    type: String,
    enum: ["USD", "INR", "TZS", "KES", "GBP", "EUR"],
    default: "USD",
  },
  cachedBalances: {
    data: [
      {
        userId:       { type: String },
        userName:     { type: String },
        isGuest:      { type: Boolean, default: false },
        paidCents:    { type: Number },
        owedCents:    { type: Number },
        balanceCents: { type: Number },
      },
    ],
    calculatedAt: { type: Date },
    version:      { type: Number, default: 0 },
  },
  budget: {
    limitCents:  { type: Number, min: 1 },
    currency:    { type: String },
    period:      { type: String, enum: ["monthly", "per-trip", "total"] },
    alertAt:     { type: Number, min: 50, max: 100, default: 80 },
    alertSentAt: { type: Date, default: null },
    createdAt:   { type: Date, default: Date.now },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for member lookup
GroupSchema.index({ "members.user": 1 });
// Index for group status filtering (Requirements 5.1)
GroupSchema.index({ status: 1 });

export default mongoose.models.Group || mongoose.model<IGroup>("Group", GroupSchema);
