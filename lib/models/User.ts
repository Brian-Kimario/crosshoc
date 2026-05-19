import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  isAdmin?: boolean;
  isDisabled?: boolean;
  notificationPrefs?: Record<string, boolean>;
  pushSubscriptions?: Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
    createdAt?: Date;
  }>;
  createdAt: Date;
  updatedAt?: Date;
  loginAttempts: number;
  lockUntil?: Date | null;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  tokenVersion: number;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  emailPrefs?: {
    newLogin?: boolean;
    groupInvite?: boolean;
    inviteExpiringSoon?: boolean;
    expenseVoided?: boolean;
    settlementVoided?: boolean;
    removedFromGroup?: boolean;
    groupDeleted?: boolean;
  };

  // 1.1 Profile fields
  avatarUrl: string | null;
  bio: string;
  displayName: string;

  // 1.2 Preferences sub-document
  preferences: {
    currency: string;
    splitMethod: "equal" | "percent" | "exact";
    timezone: string;
  };

  // 1.3 Email-change flow fields
  pendingEmail: string | null;
  pendingEmailToken: string | null;
  pendingEmailTokenExpiry: Date | null;

  // 1.4 Session tracking
  sessions: Array<{
    sessionId: string;
    userAgent: string;
    ipAddress: string;
    createdAt: Date;
    lastSeenAt: Date;
    isCurrent: boolean;
  }>;

  // 1.5 Account lifecycle fields
  deletionRequestedAt: Date | null;
  dataExportToken: string | null;
  dataExportExpiry: Date | null;
}

const UserSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, "Please provide a name"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 6,
    select: false,
  },
  avatar: {
    type: String,
    default: null,
  },
  isAdmin: {
    type: Boolean,
    default: false,
    index: true,
  },
  isDisabled: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Per-type notification preferences.
  // If a key is absent or true → send. If explicitly false → skip.
  notificationPrefs: {
    expense_added:        { type: Boolean, default: true },
    expense_edited:       { type: Boolean, default: true },
    expense_deleted:      { type: Boolean, default: true },
    settlement_made:      { type: Boolean, default: true },
    settlement_confirmed: { type: Boolean, default: true },
    settlement_disputed:  { type: Boolean, default: true },
    member_joined:        { type: Boolean, default: true },
    guest_joined:         { type: Boolean, default: true },
    invite_expiring:      { type: Boolean, default: true },
    debt_reminder:        { type: Boolean, default: true },
  },
  // Web Push API subscriptions (one per device/browser)
  pushSubscriptions: [
    {
      endpoint:  { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
      },
      userAgent: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  lastLoginIp: { type: String, default: null },
  tokenVersion: { type: Number, default: 0, required: true },
  passwordResetToken: {
    type: String,
    default: null,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    default: null,
    select: false,
  },
  emailPrefs: {
    newLogin:           { type: Boolean, default: true },
    groupInvite:        { type: Boolean, default: true },
    inviteExpiringSoon: { type: Boolean, default: true },
    expenseVoided:      { type: Boolean, default: true },
    settlementVoided:   { type: Boolean, default: true },
    removedFromGroup:   { type: Boolean, default: true },
    groupDeleted:       { type: Boolean, default: true },
  },

  // 1.1 Profile fields
  avatarUrl:   { type: String, default: null },
  bio:         { type: String, default: "", maxlength: 200 },
  displayName: { type: String, default: "" },

  // 1.2 Preferences sub-document
  preferences: {
    currency:    { type: String, default: "USD" },
    splitMethod: { type: String, enum: ["equal", "percent", "exact"], default: "equal" },
    timezone:    { type: String, default: "UTC" },
  },

  // 1.3 Email-change flow fields
  pendingEmail:            { type: String, default: null },
  pendingEmailToken:       { type: String, default: null, select: false },
  pendingEmailTokenExpiry: { type: Date,   default: null },

  // 1.4 Session tracking
  sessions: [{
    sessionId:  { type: String, required: true },
    userAgent:  { type: String, default: "Unknown" },
    ipAddress:  { type: String, default: "Unknown" },
    createdAt:  { type: Date,   default: Date.now },
    lastSeenAt: { type: Date,   default: Date.now },
    isCurrent:  { type: Boolean, default: false },
  }],

  // 1.5 Account lifecycle fields
  deletionRequestedAt: { type: Date,   default: null },
  dataExportToken:     { type: String, default: null },
  dataExportExpiry:    { type: Date,   default: null },
});

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
