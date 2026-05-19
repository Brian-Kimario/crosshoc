import mongoose, { Schema, Document } from "mongoose";

export interface IExchangeRate extends Document {
  base: string;       // currency code e.g. "USD"
  target: string;     // currency code e.g. "EUR"
  rate: number;       // positive decimal
  source: string;     // e.g. "manual", "openexchangerates"
  fetchedAt: Date;
}

const ExchangeRateSchema: Schema = new Schema({
  base: {
    type: String,
    required: [true, "Please provide a base currency code"],
    trim: true,
    uppercase: true,
  },
  target: {
    type: String,
    required: [true, "Please provide a target currency code"],
    trim: true,
    uppercase: true,
  },
  rate: {
    type: Number,
    required: [true, "Please provide an exchange rate"],
    min: [0, "Rate must be a positive number"],
    validate: {
      validator: (v: number) => v > 0,
      message: "Rate must be a positive number",
    },
  },
  source: {
    type: String,
    required: [true, "Please provide a source"],
    trim: true,
    default: "manual",
  },
  fetchedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

// Unique compound index on base + target for efficient lookups
ExchangeRateSchema.index({ base: 1, target: 1 }, { unique: true });

export default mongoose.models.ExchangeRate ||
  mongoose.model<IExchangeRate>("ExchangeRate", ExchangeRateSchema);
