import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IExpense extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  description: string;
  amount: number;
  category?: string;
  splitType: 'equal' | 'percentage' | 'exact';
  paidBy: Types.ObjectId;
  createdBy: Types.ObjectId;
  splits: Array<{
    user: Types.ObjectId;
    amount: number;
  }>;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
}

const ExpenseSchema: Schema = new Schema({
  group: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Please provide an expense description'],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Please provide an expense amount'],
    min: [0, 'Amount must be greater than 0'],
  },
  category: {
    type: String,
    default: 'other',
    trim: true,
  },
  splitType: {
    type: String,
    enum: ['equal', 'percentage', 'exact'],
    default: 'equal',
    required: true,
  },
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  splits: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      amount: {
        type: Number,
        required: true,
        min: [0, 'Split amount must be greater than or equal to 0'],
      },
    },
  ],
  receiptUrl: {
    type: String,
    default: null,
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

export default mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);
