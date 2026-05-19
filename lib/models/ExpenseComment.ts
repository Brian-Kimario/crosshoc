import mongoose, { Schema, Document, Types } from "mongoose";

export interface IExpenseComment extends Document {
  _id: Types.ObjectId;
  expense: Types.ObjectId;
  group: Types.ObjectId;
  author?: Types.ObjectId;    // null for guest comments
  authorName: string;
  isGuest: boolean;           // default false
  guestId?: string;
  text: string;
  editedAt?: Date;
  deletedAt?: Date;           // soft delete
  createdAt: Date;
}

const ExpenseCommentSchema: Schema = new Schema({
  expense: {
    type: Schema.Types.ObjectId,
    ref: "Expense",
    required: true,
  },
  group: {
    type: Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  authorName: {
    type: String,
    required: [true, "Please provide an author name"],
    trim: true,
  },
  isGuest: {
    type: Boolean,
    default: false,
  },
  guestId: {
    type: String,
    default: null,
  },
  text: {
    type: String,
    required: [true, "Please provide comment text"],
    trim: true,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for common query patterns
ExpenseCommentSchema.index({ expense: 1, createdAt: 1 });
ExpenseCommentSchema.index({ expense: 1, deletedAt: 1 });

export default mongoose.models.ExpenseComment ||
  mongoose.model<IExpenseComment>("ExpenseComment", ExpenseCommentSchema);
