/**
 * Property-based tests for email templates.
 *
 * Feature: transactional-email, Property 12: Templates render monetary amounts in human-readable format
 *
 * Validates: Requirements 7.6
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '@react-email/components';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// server-only throws in test environments; mock it as a no-op
vi.mock('server-only', () => ({}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ExpenseVoidedEmail } from '@/emails/ExpenseVoidedEmail';
import { SettlementVoidedEmail } from '@/emails/SettlementVoidedEmail';

// ---------------------------------------------------------------------------
// Property 12: Templates render monetary amounts in human-readable format
// ---------------------------------------------------------------------------

/**
 * Check that the raw integer cent value does not appear as a standalone amount
 * in the rendered HTML (i.e., not preceded by "$" and not part of a decimal).
 *
 * We only check for raw integers >= 100 (3+ digits) to avoid false positives
 * with single/double digit numbers that naturally appear in HTML (CSS values,
 * attribute values, etc.). For amounts < 100 cents, the formatted decimal
 * representation (e.g., "$0.50") is clearly human-readable and the raw integer
 * (e.g., "50") is too short to be meaningfully distinguished from other HTML content.
 *
 * The key property being tested is that the template renders the amount prop
 * as-is (the pre-formatted string) and does not expose the raw integer value
 * as the displayed amount.
 */
function assertNoRawIntegerAmount(html: string, cents: number, formatted: string): void {
  // Only check for raw integers with 3+ digits to avoid false positives
  if (cents < 100) return;

  const rawStr = String(cents);

  // Strip the formatted amount occurrences from the HTML before checking,
  // since the formatted string itself may contain digit sequences
  const htmlWithoutFormatted = html.split(formatted).join('AMOUNT_PLACEHOLDER');

  // Check that the raw integer does not appear as a standalone number
  // (not surrounded by other digits)
  const standaloneRawPattern = new RegExp(`(?<!\\d)${rawStr}(?!\\d)`);
  if (standaloneRawPattern.test(htmlWithoutFormatted)) {
    throw new Error(
      `Rendered HTML contains raw integer "${rawStr}" without currency symbol. ` +
      `Expected only the formatted amount "${formatted}" to appear as the amount value.`
    );
  }
}

describe('Property 12: Templates render monetary amounts in human-readable format', () => {
  it(
    'ExpenseVoidedEmail renders formatted amount and does not contain raw integer alone',
    async () => {
      // Feature: transactional-email, Property 12: Templates render monetary amounts in human-readable format
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          async (cents) => {
            // Format at call site: cents → "$12.50"
            const formatted = '$' + (cents / 100).toFixed(2);

            const element = React.createElement(ExpenseVoidedEmail, {
              name: 'Test User',
              expenseDescription: 'Test Expense',
              amount: formatted,
              groupName: 'Test Group',
              reason: 'Test reason',
              supportEmail: 'support@spliteasy.app',
            });

            const html = await render(element);

            // Assert rendered HTML contains the formatted string (e.g., "$12.50")
            if (!html.includes(formatted)) {
              throw new Error(
                `Expected rendered HTML to contain formatted amount "${formatted}" but it did not`
              );
            }

            // Assert rendered HTML does NOT contain the raw integer alone
            assertNoRawIntegerAmount(html, cents, formatted);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'SettlementVoidedEmail renders formatted amount and does not contain raw integer alone',
    async () => {
      // Feature: transactional-email, Property 12: Templates render monetary amounts in human-readable format
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          async (cents) => {
            // Format at call site: cents → "$12.50"
            const formatted = '$' + (cents / 100).toFixed(2);

            const element = React.createElement(SettlementVoidedEmail, {
              name: 'Test User',
              amount: formatted,
              groupName: 'Test Group',
              fromUserName: 'Alice',
              toUserName: 'Bob',
              reason: 'Test reason',
              supportEmail: 'support@spliteasy.app',
            });

            const html = await render(element);

            // Assert rendered HTML contains the formatted string (e.g., "$12.50")
            if (!html.includes(formatted)) {
              throw new Error(
                `Expected rendered HTML to contain formatted amount "${formatted}" but it did not`
              );
            }

            // Assert rendered HTML does NOT contain the raw integer alone
            assertNoRawIntegerAmount(html, cents, formatted);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 13: Templates include plain-text fallback URL below every action button
// ---------------------------------------------------------------------------

// Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button

import { WelcomeEmail } from '@/emails/WelcomeEmail';
import { ForgotPasswordEmail } from '@/emails/ForgotPasswordEmail';
import { AccountReEnabledEmail } from '@/emails/AccountReEnabledEmail';
import { AdminTriggeredResetEmail } from '@/emails/AdminTriggeredResetEmail';
import { AccountLockedEmail } from '@/emails/AccountLockedEmail';
import { GroupInviteEmail } from '@/emails/GroupInviteEmail';

/**
 * Assert that the rendered HTML contains the given URL as plain text
 * (i.e., as visible text content, not only as an href attribute value).
 *
 * React Email renders Link components as <a href="url">url</a>, so the URL
 * appears both as an href and as text content. We verify the URL appears
 * as text by checking it is present outside of an attribute context —
 * specifically that it appears as a text node (preceded by ">" and followed
 * by "<" in the rendered HTML).
 *
 * HTML special characters in the URL (e.g., &, ', <, >) are entity-encoded
 * by React Email when rendered as text content, so we encode the URL before
 * searching.
 */
function htmlEncodeUrl(url: string): string {
  return url
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function assertPlainTextUrl(html: string, url: string): void {
  // HTML-encode the URL to match how React Email renders it as text content
  const encodedUrl = htmlEncodeUrl(url);

  // The URL must appear as visible text content (between > and <)
  // This matches the pattern: >...encodedUrl...<  which is text node content
  const textNodePattern = new RegExp(`>[^<]*${escapeRegex(encodedUrl)}[^<]*<`);
  if (!textNodePattern.test(html)) {
    throw new Error(
      `Expected rendered HTML to contain URL "${url}" as plain text (text node content), ` +
      `but it only appears as an attribute value or is absent entirely.`
    );
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Property 13: Templates include plain-text fallback URL below every action button', () => {
  it(
    'WelcomeEmail contains dashboardUrl as plain text',
    async () => {
      // Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button
      // Validates: Requirements 7.7
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (dashboardUrl) => {
            const element = React.createElement(WelcomeEmail, {
              name: 'Test User',
              dashboardUrl,
            });
            const html = await render(element);
            assertPlainTextUrl(html, dashboardUrl);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'ForgotPasswordEmail contains resetUrl as plain text',
    async () => {
      // Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button
      // Validates: Requirements 7.7
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (resetUrl) => {
            const element = React.createElement(ForgotPasswordEmail, {
              name: 'Test User',
              resetUrl,
              expiresInMinutes: 60,
            });
            const html = await render(element);
            assertPlainTextUrl(html, resetUrl);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'AccountReEnabledEmail contains dashboardUrl as plain text',
    async () => {
      // Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button
      // Validates: Requirements 7.7
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (dashboardUrl) => {
            const element = React.createElement(AccountReEnabledEmail, {
              name: 'Test User',
              dashboardUrl,
            });
            const html = await render(element);
            assertPlainTextUrl(html, dashboardUrl);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'AdminTriggeredResetEmail contains resetUrl as plain text',
    async () => {
      // Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button
      // Validates: Requirements 7.7
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (resetUrl) => {
            const element = React.createElement(AdminTriggeredResetEmail, {
              name: 'Test User',
              resetUrl,
              expiresInMinutes: 60,
              supportEmail: 'support@spliteasy.app',
            });
            const html = await render(element);
            assertPlainTextUrl(html, resetUrl);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'AccountLockedEmail contains forgotPasswordUrl as plain text',
    async () => {
      // Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button
      // Validates: Requirements 7.7
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (forgotPasswordUrl) => {
            const element = React.createElement(AccountLockedEmail, {
              name: 'Test User',
              lockDurationMinutes: 15,
              forgotPasswordUrl,
            });
            const html = await render(element);
            assertPlainTextUrl(html, forgotPasswordUrl);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    'GroupInviteEmail contains inviteUrl as plain text',
    async () => {
      // Feature: transactional-email, Property 13: Templates include a plain-text fallback URL below every action button
      // Validates: Requirements 7.7
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (inviteUrl) => {
            const element = React.createElement(GroupInviteEmail, {
              inviterName: 'Alice',
              groupName: 'Test Group',
              inviteUrl,
              expiresAt: '2025-12-31',
            });
            const html = await render(element);
            assertPlainTextUrl(html, inviteUrl);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
