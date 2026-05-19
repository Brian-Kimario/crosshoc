/**
 * Central notification writer.
 * Called by every API route that needs to send a notification.
 * NEVER throws — notification failure must never crash the main operation.
 */

import dbConnect from "./db";
import Notification from "./models/Notification";
import User from "./models/User";
import { pushToUser } from "./notification-stream";
import mongoose from "mongoose";

export type NotificationType =
  | "expense_added"
  | "expense_edited"
  | "expense_deleted"
  | "settlement_made"
  | "settlement_confirmed"
  | "settlement_disputed"
  | "member_joined"
  | "guest_joined"
  | "invite_expiring"
  | "debt_reminder"
  | "group_created"
  | "group_deleted"
  | "budget_alert";

export interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  groupId?: string;
  actorName?: string;
  amount?: number;       // integer cents
  currency?: string;
  resourceId?: string;   // expenseId or settlementId
  metadata?: Record<string, unknown>;
}

export async function notify(params: NotifyParams): Promise<void> {
  try {
    await dbConnect();

    // ── Preference check ──────────────────────────────────────────────────
    const user = await User.findById(params.userId)
      .select("notificationPrefs")
      .lean() as any;

    const prefs = user?.notificationPrefs ?? {};
    // If the preference key exists and is explicitly false, skip
    if (prefs[params.type] === false) return;

    // ── Persist to DB ─────────────────────────────────────────────────────
    const doc = await Notification.create({
      userId:     new mongoose.Types.ObjectId(params.userId),
      type:       params.type,
      title:      params.title,
      body:       params.body,
      groupId:    params.groupId
        ? new mongoose.Types.ObjectId(params.groupId)
        : undefined,
      actorName:  params.actorName,
      amount:     params.amount,
      currency:   params.currency ?? "USD",
      resourceId: params.resourceId,
      metadata:   params.metadata,
      read:       false,
      createdAt:  new Date(),
    });

    // ── Push to SSE stream (no-op if user is offline) ─────────────────────
    pushToUser(params.userId, {
      type: "notification",
      notification: {
        _id:        doc._id.toString(),
        type:       doc.type,
        title:      doc.title,
        body:       doc.body,
        groupId:    doc.groupId?.toString(),
        amount:     doc.amount,
        currency:   doc.currency,
        resourceId: doc.resourceId,
        read:       false,
        createdAt:  doc.createdAt.toISOString(),
      },
    });

    // ── Web push (if user has registered push subscriptions) ─────────────
    await sendWebPush(params.userId, {
      title:     params.title,
      body:      params.body,
      id:        doc._id.toString(),
      url:       params.groupId
        ? `/groups/${params.groupId}`
        : "/settlements",
    });
  } catch (err) {
    console.error("[notify] Failed:", err, { type: params.type, userId: params.userId });
  }
}

/**
 * Notify multiple users at once.
 * Skips the actor so they don't get notified about their own action.
 */
export async function notifyMany(
  userIds: string[],
  actorId: string,
  params: Omit<NotifyParams, "userId">
): Promise<void> {
  const recipients = userIds.filter((id) => id !== actorId);
  await Promise.all(recipients.map((userId) => notify({ ...params, userId })));
}

// ── Web push helper ───────────────────────────────────────────────────────────

async function sendWebPush(
  userId: string,
  payload: { title: string; body: string; id: string; url: string }
): Promise<void> {
  if (
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_EMAIL
  ) {
    return; // Web push not configured — skip silently
  }

  try {
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const user = await User.findById(userId)
      .select("pushSubscriptions")
      .lean() as any;

    const subs: any[] = user?.pushSubscriptions ?? [];
    if (subs.length === 0) return;

    await Promise.all(
      subs.map((sub) =>
        webpush
          .sendNotification(sub, JSON.stringify(payload))
          .catch((err: any) => {
            // 410 = subscription expired/revoked — remove it
            if (err?.statusCode === 410) {
              User.findByIdAndUpdate(userId, {
                $pull: { pushSubscriptions: { endpoint: sub.endpoint } },
              }).catch(() => {});
            }
          })
      )
    );
  } catch (err) {
    console.error("[notify] Web push failed:", err);
  }
}
