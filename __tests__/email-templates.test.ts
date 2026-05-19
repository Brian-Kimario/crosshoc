/**
 * Unit tests for all 16 email templates.
 *
 * Validates: Requirements 7.2, 7.3, 7.4, 7.7
 *
 * Each template is tested for:
 * 1. Renders without throwing when given valid props
 * 2. Rendered output contains a <Preview> element (check for "preview" in HTML)
 * 3. Templates with action buttons: rendered HTML contains the URL as plain text
 * 4. ExpenseVoidedEmail / SettlementVoidedEmail: rendered HTML contains amount prop as-is
 */

import { describe, it, expect } from 'vitest';
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

import { WelcomeEmail } from '@/emails/WelcomeEmail';
import { ForgotPasswordEmail } from '@/emails/ForgotPasswordEmail';
import { PasswordChangedEmail } from '@/emails/PasswordChangedEmail';
import { EmailChangedEmail } from '@/emails/EmailChangedEmail';
import { AccountDisabledEmail } from '@/emails/AccountDisabledEmail';
import { AccountReEnabledEmail } from '@/emails/AccountReEnabledEmail';
import { AccountDeletedEmail } from '@/emails/AccountDeletedEmail';
import { AdminTriggeredResetEmail } from '@/emails/AdminTriggeredResetEmail';
import { NewLoginEmail } from '@/emails/NewLoginEmail';
import { AccountLockedEmail } from '@/emails/AccountLockedEmail';
import { RemovedFromGroupEmail } from '@/emails/RemovedFromGroupEmail';
import { GroupDeletedEmail } from '@/emails/GroupDeletedEmail';
import { GroupInviteEmail } from '@/emails/GroupInviteEmail';
import { InviteExpiringSoonEmail } from '@/emails/InviteExpiringSoonEmail';
import { ExpenseVoidedEmail } from '@/emails/ExpenseVoidedEmail';
import { SettlementVoidedEmail } from '@/emails/SettlementVoidedEmail';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a React Email component to an HTML string.
 * Uses React.createElement to avoid needing JSX transform in vitest.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderTemplate(
  component: React.ComponentType<any>,
  props: Record<string, unknown>
): Promise<string> {
  const element = React.createElement(component, props);
  return render(element);
}

// ---------------------------------------------------------------------------
// 1. WelcomeEmail
// ---------------------------------------------------------------------------

describe('WelcomeEmail', () => {
  const props = {
    name: 'Alice',
    dashboardUrl: 'https://spliteasy.app/dashboard',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(WelcomeEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      WelcomeEmail,
      props
    );
    // The <Preview> component renders as a hidden div with data-skip-in-text attribute
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the dashboardUrl as plain text', async () => {
    const html = await renderTemplate(
      WelcomeEmail,
      props
    );
    expect(html).toContain(props.dashboardUrl);
  });
});

// ---------------------------------------------------------------------------
// 2. ForgotPasswordEmail
// ---------------------------------------------------------------------------

describe('ForgotPasswordEmail', () => {
  const props = {
    name: 'Bob',
    resetUrl: 'https://spliteasy.app/reset-password?token=abc123',
    expiresInMinutes: 60,
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(ForgotPasswordEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      ForgotPasswordEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the resetUrl as plain text', async () => {
    const html = await renderTemplate(
      ForgotPasswordEmail,
      props
    );
    expect(html).toContain(props.resetUrl);
  });
});

// ---------------------------------------------------------------------------
// 3. PasswordChangedEmail
// ---------------------------------------------------------------------------

describe('PasswordChangedEmail', () => {
  const props = {
    name: 'Carol',
    settingsUrl: 'https://spliteasy.app/settings',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(PasswordChangedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      PasswordChangedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 4. EmailChangedEmail
// ---------------------------------------------------------------------------

describe('EmailChangedEmail', () => {
  const props = {
    name: 'Dave',
    oldEmail: 'dave.old@example.com',
    newEmail: 'dave.new@example.com',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(EmailChangedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      EmailChangedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 5. AccountDisabledEmail
// ---------------------------------------------------------------------------

describe('AccountDisabledEmail', () => {
  const props = {
    name: 'Eve',
    reason: 'Violation of terms of service',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing (with reason)', async () => {
    await expect(
      renderTemplate(AccountDisabledEmail, props)
    ).resolves.toBeTruthy();
  });

  it('renders without throwing (without reason)', async () => {
    const propsNoReason = { name: 'Eve', supportEmail: 'support@spliteasy.app' };
    await expect(
      renderTemplate(AccountDisabledEmail, propsNoReason)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      AccountDisabledEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 6. AccountReEnabledEmail
// ---------------------------------------------------------------------------

describe('AccountReEnabledEmail', () => {
  const props = {
    name: 'Frank',
    dashboardUrl: 'https://spliteasy.app/dashboard',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(AccountReEnabledEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      AccountReEnabledEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the dashboardUrl as plain text', async () => {
    const html = await renderTemplate(
      AccountReEnabledEmail,
      props
    );
    expect(html).toContain(props.dashboardUrl);
  });
});

// ---------------------------------------------------------------------------
// 7. AccountDeletedEmail
// ---------------------------------------------------------------------------

describe('AccountDeletedEmail', () => {
  const props = {
    name: 'Grace',
    reason: 'Account inactivity',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing (with reason)', async () => {
    await expect(
      renderTemplate(AccountDeletedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('renders without throwing (without reason)', async () => {
    const propsNoReason = { name: 'Grace', supportEmail: 'support@spliteasy.app' };
    await expect(
      renderTemplate(AccountDeletedEmail, propsNoReason)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      AccountDeletedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 8. AdminTriggeredResetEmail
// ---------------------------------------------------------------------------

describe('AdminTriggeredResetEmail', () => {
  const props = {
    name: 'Heidi',
    resetUrl: 'https://spliteasy.app/reset-password?token=xyz789',
    expiresInMinutes: 60,
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(AdminTriggeredResetEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      AdminTriggeredResetEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the resetUrl as plain text', async () => {
    const html = await renderTemplate(
      AdminTriggeredResetEmail,
      props
    );
    expect(html).toContain(props.resetUrl);
  });
});

// ---------------------------------------------------------------------------
// 9. NewLoginEmail
// ---------------------------------------------------------------------------

describe('NewLoginEmail', () => {
  const props = {
    name: 'Ivan',
    loginAt: '2024-01-15T10:30:00Z',
    ipAddress: '192.168.1.1',
    location: 'New York, US',
    settingsUrl: 'https://spliteasy.app/settings',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing (with location)', async () => {
    await expect(
      renderTemplate(NewLoginEmail, props)
    ).resolves.toBeTruthy();
  });

  it('renders without throwing (without location)', async () => {
    const propsNoLocation = {
      name: 'Ivan',
      loginAt: '2024-01-15T10:30:00Z',
      ipAddress: '192.168.1.1',
      settingsUrl: 'https://spliteasy.app/settings',
      supportEmail: 'support@spliteasy.app',
    };
    await expect(
      renderTemplate(NewLoginEmail, propsNoLocation)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      NewLoginEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 10. AccountLockedEmail
// ---------------------------------------------------------------------------

describe('AccountLockedEmail', () => {
  const props = {
    name: 'Judy',
    lockDurationMinutes: 30,
    forgotPasswordUrl: 'https://spliteasy.app/forgot-password',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(AccountLockedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      AccountLockedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the forgotPasswordUrl as plain text', async () => {
    const html = await renderTemplate(
      AccountLockedEmail,
      props
    );
    expect(html).toContain(props.forgotPasswordUrl);
  });
});

// ---------------------------------------------------------------------------
// 11. RemovedFromGroupEmail
// ---------------------------------------------------------------------------

describe('RemovedFromGroupEmail', () => {
  const props = {
    name: 'Karl',
    groupName: 'Weekend Trip',
    reason: 'Violation of group rules',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(RemovedFromGroupEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      RemovedFromGroupEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 12. GroupDeletedEmail
// ---------------------------------------------------------------------------

describe('GroupDeletedEmail', () => {
  const props = {
    name: 'Laura',
    groupName: 'House Expenses',
    reason: 'Group was inactive for 12 months',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(GroupDeletedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      GroupDeletedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 13. GroupInviteEmail
// ---------------------------------------------------------------------------

describe('GroupInviteEmail', () => {
  const props = {
    recipientName: 'Mallory',
    inviterName: 'Alice',
    groupName: 'Road Trip 2024',
    inviteUrl: 'https://spliteasy.app/join/token123',
    expiresAt: '2024-02-01T00:00:00Z',
  };

  it('renders without throwing (with recipientName)', async () => {
    await expect(
      renderTemplate(GroupInviteEmail, props)
    ).resolves.toBeTruthy();
  });

  it('renders without throwing (without recipientName)', async () => {
    const propsNoRecipient = {
      inviterName: 'Alice',
      groupName: 'Road Trip 2024',
      inviteUrl: 'https://spliteasy.app/join/token123',
      expiresAt: '2024-02-01T00:00:00Z',
    };
    await expect(
      renderTemplate(GroupInviteEmail, propsNoRecipient)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      GroupInviteEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the inviteUrl as plain text', async () => {
    const html = await renderTemplate(
      GroupInviteEmail,
      props
    );
    expect(html).toContain(props.inviteUrl);
  });
});

// ---------------------------------------------------------------------------
// 14. InviteExpiringSoonEmail
// ---------------------------------------------------------------------------

describe('InviteExpiringSoonEmail', () => {
  const props = {
    name: 'Niaj',
    groupName: 'Flatmates',
    hoursRemaining: 5,
    groupUrl: 'https://spliteasy.app/groups/abc',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(InviteExpiringSoonEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      InviteExpiringSoonEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });
});

// ---------------------------------------------------------------------------
// 15. ExpenseVoidedEmail
// ---------------------------------------------------------------------------

describe('ExpenseVoidedEmail', () => {
  const props = {
    name: 'Olivia',
    expenseDescription: 'Dinner at The Grill',
    amount: '$12.50',
    groupName: 'Work Lunches',
    reason: 'Duplicate entry',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(ExpenseVoidedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      ExpenseVoidedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the amount prop as-is', async () => {
    const html = await renderTemplate(
      ExpenseVoidedEmail,
      props
    );
    expect(html).toContain(props.amount);
  });
});

// ---------------------------------------------------------------------------
// 16. SettlementVoidedEmail
// ---------------------------------------------------------------------------

describe('SettlementVoidedEmail', () => {
  const props = {
    name: 'Peter',
    amount: '$75.00',
    groupName: 'Vacation Fund',
    fromUserName: 'Alice',
    toUserName: 'Bob',
    reason: 'Settlement was recorded in error',
    supportEmail: 'support@spliteasy.app',
  };

  it('renders without throwing', async () => {
    await expect(
      renderTemplate(SettlementVoidedEmail, props)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(
      SettlementVoidedEmail,
      props
    );
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the amount prop as-is', async () => {
    const html = await renderTemplate(
      SettlementVoidedEmail,
      props
    );
    expect(html).toContain(props.amount);
  });
});

// ---------------------------------------------------------------------------
// 17. BudgetAlertEmail
// ---------------------------------------------------------------------------

import { BudgetAlertEmail } from '@/emails/BudgetAlertEmail';

describe('BudgetAlertEmail', () => {
  const baseProps = {
    name: 'Quinn',
    groupName: 'Roommates',
    groupUrl: 'https://spliteasy.app/groups/abc123',
    currentSpentCents: 85000,
    budgetLimitCents: 100000,
    percentUsed: 85,
    currency: 'USD',
    isOverBudget: false,
  };

  it('renders without throwing (approaching budget)', async () => {
    await expect(
      renderTemplate(BudgetAlertEmail, baseProps)
    ).resolves.toBeTruthy();
  });

  it('renders without throwing (over budget)', async () => {
    const overBudgetProps = {
      ...baseProps,
      currentSpentCents: 110000,
      percentUsed: 110,
      isOverBudget: true,
    };
    await expect(
      renderTemplate(BudgetAlertEmail, overBudgetProps)
    ).resolves.toBeTruthy();
  });

  it('rendered output contains a Preview element', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    expect(html).toContain('data-skip-in-text');
  });

  it('rendered HTML contains the groupUrl as plain text (fallback link)', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    expect(html).toContain(baseProps.groupUrl);
  });

  it('rendered HTML contains formatted spending amount', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    // $850.00 from 85000 cents
    expect(html).toContain('$850.00');
  });

  it('rendered HTML contains formatted budget limit', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    // $1,000.00 from 100000 cents
    expect(html).toContain('$1,000.00');
  });

  it('rendered HTML contains percentage used', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    expect(html).toContain('85%');
  });

  it('approaching budget state contains "approaching" message', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    expect(html).toContain('approaching');
  });

  it('over budget state contains "exceeded" message', async () => {
    const overBudgetProps = {
      ...baseProps,
      currentSpentCents: 110000,
      percentUsed: 110,
      isOverBudget: true,
    };
    const html = await renderTemplate(BudgetAlertEmail, overBudgetProps);
    expect(html).toContain('exceeded');
  });

  it('renders group name in the email', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    expect(html).toContain(baseProps.groupName);
  });

  it('renders member name in the email', async () => {
    const html = await renderTemplate(BudgetAlertEmail, baseProps);
    expect(html).toContain(baseProps.name);
  });
});
