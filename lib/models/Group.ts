import mongoose, { Schema, Document, Types } from 'mongoose';

export type GroupCurrency = 'USD' | 'INR' | 'TZS';

export interface IGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  creator: Types.ObjectId;
  members: Array<{
    user: Types.ObjectId;
    shareRatio: number;
  }>;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  currency: GroupCurrency;
  createdAt: Date;
  updatedAt?: Date;
}

const GroupSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Please provide a group name'],
    trim: true,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      shareRatio: {
        type: Number,
        default: 100,
      },
    },
  ],
  inviteToken: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },
  inviteExpiresAt: {
    type: Date,
    default: null,
  },
  currency: {
    type: String,
    enum: ['USD', 'INR', 'TZS'],
    default: 'USD',
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

export default mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema);
