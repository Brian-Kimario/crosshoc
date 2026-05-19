import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRecurringConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  nextDueAt?: Date;
  endDate?: Date;
  templateId?: Types.ObjectId;  // ref RecurringExpense
  parentId?: Types.ObjectId;    // ref RecurringExpense
  generationCount?: number;
}

export interface IEditHistoryEntry {
  editedBy: Types.ObjectId;
  editedAt: Date;
  changes: string[];  // field names that changed
  before: {
    description: string;
    amount: number;   // integer cents
    category: string;
    splits: Array<{ user: Types.ObjectId; amount: number }>;
  };
}

export interface IExpense extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  description: string;
  amount: number;           // integer cents
  category?: string;
  splitType: "equal" | "percentage" | "exact";
  paidBy: Types.ObjectId | null;  // null for guest-paid expenses
  createdBy: Types.ObjectId;
  splits: Array<{
    user: Types.ObjectId;
    amount: number;         // integer cents
  }>;
  receiptUrl?: string;
  isGuest?: boolean;
  guestId?: string;
  guestName?: string;
  guestShare?: number;      // integer cents — guest's own portion
  currency?: string;
  isVoided?: boolean;       // default: false; true when an admin has voided this expense
  voidedAt?: Date;          // set to the void timestamp when isVoided becomes true
  recurringConfig?: IRecurringConfig;
  editHistory: IEditHistoryEntry[];
  createdAt: Date;
  updatedAt?: Date;
}

const ExpenseSchema: Schema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: [true, "Please provide an expense description"],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, "Please provide an expense amount"],
    min: [1, "Amount must be at least 1 cent"],
    validate: {
      validator: Number.isInteger,
      message: "Amount must be stored as integer cents",
    },
  },
  category: {
    type: String,
    default: "other",
    trim: true,
  },
  splitType: {
    type: String,
    enum: ["equal", "percentage", "exact"],
    default: "equal",
    required: true,
  },
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,          // null = guest paid
  },
  createdBy: {
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
  receiptUrl: {
    type: String,
    default: null,
  },
  isGuest: {
    type: Boolean,
    default: false,
  },
  guestId: {
    type: String,
    default: null,
    index: true,
    sparse: true,
  },
  guestName: {
    type: String,
    default: null,
  },
  guestShare: {
    type: Number,
    default: null,
    validate: {
      validator: (v: number | null) => v === null || Number.isInteger(v),
      message: "guestShare must be integer cents or null",
    },
  },
  currency: {
    type: String,
    default: null,
  },
  isVoided: {
    type: Boolean,
    default: false,
    index: true,
  },
  voidedAt: {
    type: Date,
    default: null,
  },
  recurringConfig: {
    enabled: {
      type: Boolean,
      required: false,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly"],
      required: false,
    },
    nextDueAt: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringExpense",
      default: null,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringExpense",
      default: null,
    },
    generationCount: {
      type: Number,
      default: 0,
    },
  },
  editHistory: {
    type: [
      {
        editedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        editedAt: {
          type: Date,
          required: true,
        },
        changes: {
          type: [String],
          default: [],
        },
        before: {
          description: { type: String, required: true },
          amount: { type: Number, required: true },
          category: { type: String, required: true },
          splits: [
            {
              user: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
              },
              amount: { type: Number, required: true },
            },
          ],
        },
      },
    ],
    default: [],
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

// Compound indexes for common query patterns
ExpenseSchema.index({ group: 1, createdAt: -1 });
ExpenseSchema.index({ group: 1, "splits.user": 1 });
ExpenseSchema.index({ group: 1, paidBy: 1 });

export default mongoose.models.Expense ||
  mongoose.model<IExpense>("Expense", ExpenseSchema);
