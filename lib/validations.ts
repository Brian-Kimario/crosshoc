import { z } from 'zod';
import { NextResponse } from 'next/server';

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    guestId: z.string().optional(),
  })
  .strict();

export const RegisterSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(6),
    guestId: z.string().optional(),
  })
  .strict();

// ─── Group Schemas ────────────────────────────────────────────────────────────

export const CreateGroupSchema = z
  .object({
    name: z.string().min(1).max(100),
    currency: z.enum(['USD', 'INR', 'TZS', 'KES', 'GBP', 'EUR']).optional(),
  })
  .strict();

export const UpdateGroupSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    currency: z.enum(['USD', 'INR', 'TZS', 'KES', 'GBP', 'EUR']).optional(),
  })
  .strict();

// ─── Expense Schemas ──────────────────────────────────────────────────────────

const SplitItemSchema = z.object({
  userId: z.string(),
  amount: z.number().int().positive(),
});

export const CreateExpenseSchema = z
  .object({
    description: z.string(),
    totalAmount: z.number().int().positive(),
    splits: z.array(SplitItemSchema),
  })
  .strict()
  .refine(
    (data) => data.splits.reduce((sum, x) => sum + x.amount, 0) === data.totalAmount,
    { message: 'Split amounts must sum to totalAmount', path: ['splits'] }
  );

export const UpdateExpenseSchema = z
  .object({
    description: z.string().optional(),
    totalAmount: z.number().int().positive().optional(),
    splits: z.array(SplitItemSchema).optional(),
  })
  .strict()
  .refine(
    (data) => {
      // Only validate the sum when both splits and totalAmount are provided
      if (data.splits !== undefined && data.totalAmount !== undefined) {
        return data.splits.reduce((sum, x) => sum + x.amount, 0) === data.totalAmount;
      }
      return true;
    },
    { message: 'Split amounts must sum to totalAmount', path: ['splits'] }
  );

// ─── Settlement Schemas ───────────────────────────────────────────────────────

export const CreateSettlementSchema = z
  .object({
    fromUserId: z.string(),
    toUserId: z.string(),
    amount: z.number().int().positive(),
    method: z.string().optional(),
    note: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })
  .strict()
  .refine((data) => data.fromUserId !== data.toUserId, {
    message: 'fromUserId and toUserId must be different',
    path: ['toUserId'],
  });

export const DisputeSettlementSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

// ─── Group Join / Guest Schemas ───────────────────────────────────────────────

export const JoinGroupSchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();

export const GuestActivateSchema = z
  .object({
    token: z.string().min(1),
    displayName: z.string().min(1).max(50),
  })
  .strict();

// ─── Profile / Password Schemas ───────────────────────────────────────────────

export const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    avatar: z.string().url().optional(),
  })
  .strict();

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  })
  .strict();

// ─── parseBody helper ─────────────────────────────────────────────────────────

/**
 * Parse and validate an unknown request body against a Zod schema.
 *
 * Returns `{ success: true, data }` on success, or
 * `{ success: false, response }` with a pre-built HTTP 400 NextResponse on failure.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      {
        error: 'Validation failed',
        details: schema.safeParse(data).error?.flatten(),
      },
      { status: 400 }
    ),
  };
}
