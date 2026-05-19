import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFeedback extends Document {
  userId?: Types.ObjectId;
  message: string;
  category: "bug" | "feature" | "general";
  read: boolean;
  createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
  userId:   { type: Schema.Types.ObjectId, ref: "User", default: null },
  message:  { type: String, required: true, maxlength: 2000 },
  category: {
    type: String,
    enum: ["bug", "feature", "general"],
    default: "general",
  },
  read:     { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

FeedbackSchema.index({ read: 1, createdAt: -1 });

export default mongoose.models.Feedback ||
  mongoose.model<IFeedback>("Feedback", FeedbackSchema);
