import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRecurringExpense extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  description: string;
  amount: number;           // integer cents, positive
  category: string;
  paidBy: Types.ObjectId;
  splits: Array<{
    user: Types.ObjectId;
    amount: number;         // integer cents
  }>;
  splitType: "equal" | "percentage" | "exact";
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  startDate: Date;
  endDate?: Date;
  nextDueAt: Date;
  isActive: boolean;        // default true
  pausedAt?: Date;
  generationCount: number;  // default 0
  lastGeneratedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const RecurringExpenseSchema: Schema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: [true, "Please provide a description"],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, "Please provide an amount"],
    min: [1, "Amount must be at least 1 cent"],
    validate: {
      validator: Number.isInteger,
      message: "Amount must be stored as a positive integer (cents)",
    },
  },
  category: {
    type: String,
    default: "other",
    trim: true,
  },
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  splits: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      amount: {
        type: Number,
        required: true,
        min: [0, "Split amount must be >= 0"],
        validate: {
          validator: Number.isInteger,
          message: "Split amount must be stored as integer cents",
        },
      },
    },
  ],
  splitType: {
    type: String,
    enum: ["equal", "percentage", "exact"],
    default: "equal",
    required: true,
  },
  frequency: {
    type: String,
    enum: ["daily", "weekly", "biweekly", "monthly"],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    default: null,
  },
  nextDueAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  pausedAt: {
    type: Date,
    default: null,
  },
  generationCount: {
    type: Number,
    default: 0,
  },
  lastGeneratedAt: {
    type: Date,
    default: null,
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
});

// Indexes for common query patterns
RecurringExpenseSchema.index({ group: 1, isActive: 1 });
RecurringExpenseSchema.index({ nextDueAt: 1, isActive: 1 });

export default mongoose.models.RecurringExpense ||
  mongoose.model<IRecurringExpense>("RecurringExpense", RecurringExpenseSchema);
