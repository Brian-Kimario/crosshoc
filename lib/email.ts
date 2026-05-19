import 'server-only';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

export type EmailPrefsKey =
  | 'newLogin'
  | 'groupInvite'
  | 'inviteExpiringSoon'
  | 'expenseVoided'
  | 'settlementVoided'
  | 'removedFromGroup'
  | 'groupDeleted';

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  /** Optional: userId for emailPrefs check. If omitted, prefs check is skipped. */
  userId?: string;
  /** Optional: emailPrefs key to check before sending. */
  prefsKey?: EmailPrefsKey;
}

/**
 * Send a transactional email via Resend.
 * NEVER throws — email failure must never crash the calling operation.
 * No-op when RESEND_API_KEY is absent or set to the placeholder value.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  // 1. Dev/CI no-op guard
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_placeholder') {
    console.log('[email] No-op (RESEND_API_KEY not configured):', {
      to: params.to,
      subject: params.subject,
      template: params.react?.type?.toString?.() ?? 'unknown',
    });
    return;
  }

  // 2. emailPrefs check (opt-out)
  if (params.userId && params.prefsKey) {
    try {
      const { default: User } = await import('@/lib/models/User');
      const { default: dbConnect } = await import('@/lib/db');
      await dbConnect();
      const user = await User.findById(params.userId).select('emailPrefs').lean() as {
        emailPrefs?: Partial<Record<EmailPrefsKey, boolean>>;
      } | null;
      if (user?.emailPrefs?.[params.prefsKey] === false) {
        return; // User opted out
      }
    } catch (err) {
      console.error('[email] emailPrefs check failed:', err);
      // Fail open — send the email if prefs check errors
    }
  }

  // 3. Send
  try {
    const resend = new Resend(apiKey);
    const from = process.env.EMAIL_FROM ?? 'SplitEasy <noreply@spliteasy.app>';
    await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      react: params.react,
    });
  } catch (err) {
    console.error('[email] Send failed:', err, { to: params.to, subject: params.subject });
    // Swallow — never propagate
  }
}
