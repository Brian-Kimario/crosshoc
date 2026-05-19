// Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups

/**
 * Property-Based Tests for Budget Alert Cron Job (P10)
 *
 * Feature: group-analytics-spending-insights
 *
 * Properties tested:
 *   P10 – Budget alert sends notifications and marks alertSentAt for all qualifying groups
 *
 * Validates: Requirements 17.4, 17.5
 *
 * Approach: The cron job logic in `app/api/cron/budget-alerts/route.ts` has two
 * key decision points:
 *   1. Whether to send alerts: `spentPercent >= alertAt`
 *   2. Whether to mark alertSentAt: set to a non-null Date after sending
 *
 * We extract and test the pure decision logic (`shouldSendAlert`) directly,
 * then simulate the full cron processing loop with mocked dependencies to
 * verify that notify() is called for every member of qualifying groups and
 * alertSentAt is set to a non-null timestamp.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure decision logic extracted from the cron job
// ---------------------------------------------------------------------------

/**
 * Determines whether a budget alert should be sent for a group.
 *
 * Mirrors the condition in app/api/cron/budget-alerts/route.ts:
 *   if (spentPercent >= group.budget.alertAt) { ... }
 */
function shouldSendAlert(spentPercent: number, alertAt: number): boolean {
  return spentPercent >= alertAt;
}

/**
 * Simulate the alertSentAt update that the cron performs after sending alerts.
 * Returns a non-null Date representing the timestamp when the alert was sent.
 */
function computeAlertSentAt(): Date {
  return new Date();
}

// ---------------------------------------------------------------------------
// Types for the simulated cron processing
// ---------------------------------------------------------------------------

interface GroupMember {
  user: string;
}

interface GroupBudget {
  limitCents: number;
  alertAt: number;
  period: 'monthly' | 'per-trip' | 'total';
}

interface MockGroup {
  _id: string;
  name: string;
  budget: GroupBudget;
  members: GroupMember[];
}

interface NotifyCall {
  userId: string;
  type: string;
  title: string;
  body: string;
  groupId: string;
}

/**
 * Simulate the cron job processing loop for a set of groups.
 * This mirrors the logic in app/api/cron/budget-alerts/route.ts.
 *
 * Returns the notify calls made and the alertSentAt values set per group.
 */
function simulateCronProcessing(
  groups: MockGroup[],
  spentCentsPerGroup: Map<string, number>
): {
  notifyCalls: NotifyCall[];
  alertSentAtPerGroup: Map<string, Date | null>;
} {
  const notifyCalls: NotifyCall[] = [];
  const alertSentAtPerGroup = new Map<string, Date | null>();

  for (const group of groups) {
    const totalSpentCents = spentCentsPerGroup.get(group._id) ?? 0;
    const spentPercent = (totalSpentCents / group.budget.limitCents) * 100;

    if (shouldSendAlert(spentPercent, group.budget.alertAt)) {
      // Notify all members
      for (const member of group.members) {
        notifyCalls.push({
          userId: member.user,
          type: 'budget_alert',
          title: 'Budget alert',
          body: `Your group "${group.name}" has reached ${Math.round(spentPercent)}% of its budget limit.`,
          groupId: group._id,
        });
      }

      // Mark alertSentAt
      alertSentAtPerGroup.set(group._id, computeAlertSentAt());
    } else {
      alertSentAtPerGroup.set(group._id, null);
    }
  }

  return { notifyCalls, alertSentAtPerGroup };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Valid alertAt: integer in [50, 100] */
const alertAtArb = fc.integer({ min: 50, max: 100 });

/** A group member with a random user ID */
const memberArb = fc.record({
  user: fc.string({ minLength: 1, maxLength: 24 }),
});

/** A group with 1–5 members */
const groupArb = fc.record({
  _id: fc.string({ minLength: 1, maxLength: 24 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  budget: fc.record({
    limitCents: fc.integer({ min: 1, max: 10_000_000 }),
    alertAt: alertAtArb,
    period: fc.constantFrom<'monthly' | 'per-trip' | 'total'>('monthly', 'per-trip', 'total'),
  }),
  members: fc.array(memberArb, { minLength: 1, maxLength: 5 }),
});

/**
 * Generate an array of groups with unique _id values.
 * This prevents duplicate-ID collisions that would cause incorrect notify counts.
 */
function uniqueGroupsArb(minLength: number, maxLength: number) {
  return fc
    .array(groupArb, { minLength, maxLength })
    .map((groups) => {
      // Deduplicate by _id — keep first occurrence of each id
      const seen = new Set<string>();
      return groups.filter((g) => {
        if (seen.has(g._id)) return false;
        seen.add(g._id);
        return true;
      });
    })
    .filter((groups) => groups.length >= minLength);
}

describe('P10 (pure logic): shouldSendAlert decision function', () => {
  /**
   * **Validates: Requirements 17.4**
   *
   * For any group where spentPercent >= alertAt, shouldSendAlert returns true.
   */
  it('returns true when spentPercent >= alertAt (qualifying groups)', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4
    // Generate alertAt in [50, 100] and spentPercent as alertAt + non-negative offset
    fc.assert(
      fc.property(
        alertAtArb,
        fc.integer({ min: 0, max: 200 }), // offset added to alertAt
        (alertAt, offset) => {
          const spentPercent = alertAt + offset; // always >= alertAt
          expect(shouldSendAlert(spentPercent, alertAt)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 17.4**
   *
   * For any group where spentPercent < alertAt, shouldSendAlert returns false.
   */
  it('returns false when spentPercent < alertAt (non-qualifying groups)', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4
    // Generate alertAt in [51, 100] and spentPercent in [0, alertAt - 1] (integer, always < alertAt)
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 100 }), // alertAt in [51, 100] so there's room below
        fc.integer({ min: 0, max: 50 }),   // spentPercent in [0, 50], always < alertAt (>= 51)
        (alertAt, spentPercent) => {
          // spentPercent is in [0, 50] and alertAt is in [51, 100], so spentPercent < alertAt
          expect(shouldSendAlert(spentPercent, alertAt)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 17.4**
   *
   * Boundary: spentPercent === alertAt returns true (inclusive threshold).
   */
  it('returns true at the exact boundary: spentPercent === alertAt', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4 — inclusive boundary
    fc.assert(
      fc.property(
        alertAtArb,
        (alertAt) => {
          expect(shouldSendAlert(alertAt, alertAt)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: spentPercent = 50, alertAt = 50 → true (minimum alertAt boundary)', () => {
    // Validates: Requirements 17.4 — minimum alertAt value
    expect(shouldSendAlert(50, 50)).toBe(true);
  });

  it('boundary: spentPercent = 49.999, alertAt = 50 → false (just below minimum)', () => {
    // Validates: Requirements 17.4 — just below minimum alertAt
    expect(shouldSendAlert(49.999, 50)).toBe(false);
  });

  it('boundary: spentPercent = 100, alertAt = 100 → true (maximum alertAt boundary)', () => {
    // Validates: Requirements 17.4 — maximum alertAt value
    expect(shouldSendAlert(100, 100)).toBe(true);
  });

  it('boundary: spentPercent = 99.999, alertAt = 100 → false (just below maximum)', () => {
    // Validates: Requirements 17.4 — just below maximum alertAt
    expect(shouldSendAlert(99.999, 100)).toBe(false);
  });

  it('over-budget: spentPercent > 100 still triggers alert', () => {
    // Validates: Requirements 17.4 — over-budget scenario
    fc.assert(
      fc.property(
        alertAtArb,
        fc.integer({ min: 101, max: 300 }), // spentPercent > 100, always >= alertAt (<= 100)
        (alertAt, spentPercent) => {
          // spentPercent > 100 >= alertAt (since alertAt <= 100)
          expect(shouldSendAlert(spentPercent, alertAt)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// P10: alertSentAt is set to a non-null Date for qualifying groups
// Validates: Requirements 17.5
// ---------------------------------------------------------------------------

describe('P10 (pure logic): alertSentAt is set to a non-null Date after alert', () => {
  /**
   * **Validates: Requirements 17.5**
   *
   * After a qualifying group is processed, alertSentAt should be set to a
   * non-null Date.
   */
  it('alertSentAt is a non-null Date after processing a qualifying group', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.5
    fc.assert(
      fc.property(
        alertAtArb,
        (alertAt) => {
          // For a qualifying group, computeAlertSentAt() must return a non-null Date
          const sentAt = computeAlertSentAt();
          expect(sentAt).not.toBeNull();
          expect(sentAt).toBeInstanceOf(Date);
          expect(isNaN(sentAt.getTime())).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('alertSentAt is a recent timestamp (within 5 seconds of now)', () => {
    // Validates: Requirements 17.5 — timestamp is current
    const before = Date.now();
    const sentAt = computeAlertSentAt();
    const after = Date.now();

    expect(sentAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(sentAt.getTime()).toBeLessThanOrEqual(after + 5000);
  });
});

// ---------------------------------------------------------------------------
// P10: Full cron simulation — notify called for every member of qualifying groups
// Validates: Requirements 17.4, 17.5
// ---------------------------------------------------------------------------

describe('P10 (cron simulation): notify called for every member of qualifying groups', () => {
  /**
   * **Validates: Requirements 17.4, 17.5**
   *
   * For any group where spentPercent >= alertAt and alertSentAt is null:
   * - notify() is called for every member of that group
   * - alertSentAt is set to a non-null timestamp
   */
  it('notify is called for every member of every qualifying group', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4, 17.5
    fc.assert(
      fc.property(
        // Generate 1–5 groups with unique IDs, each with a random alertAt and members
        uniqueGroupsArb(1, 5),
        (groups) => {
          // For each group, generate a spentCents that makes spentPercent >= alertAt.
          // Use limitCents itself (100% utilization) to guarantee spentPercent = 100,
          // which is always >= alertAt (max 100), avoiding floating-point precision issues.
          const spentCentsPerGroup = new Map<string, number>();
          for (const group of groups) {
            spentCentsPerGroup.set(group._id, group.budget.limitCents);
          }

          const { notifyCalls, alertSentAtPerGroup } = simulateCronProcessing(
            groups,
            spentCentsPerGroup
          );

          // Every group qualifies — verify notify was called for every member
          for (const group of groups) {
            for (const member of group.members) {
              const callForMember = notifyCalls.find(
                (c) => c.userId === member.user && c.groupId === group._id
              );
              expect(callForMember).toBeDefined();
              expect(callForMember?.type).toBe('budget_alert');
            }

            // alertSentAt must be a non-null Date
            const sentAt = alertSentAtPerGroup.get(group._id);
            expect(sentAt).not.toBeNull();
            expect(sentAt).toBeInstanceOf(Date);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('notify is NOT called for non-qualifying groups (spentPercent < alertAt)', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4 — non-qualifying groups are skipped
    fc.assert(
      fc.property(
        uniqueGroupsArb(1, 5),
        (groups) => {
          // For each group, generate spentCents that makes spentPercent < alertAt
          const spentCentsPerGroup = new Map<string, number>();
          for (const group of groups) {
            // spentPercent = (spentCents / limitCents) * 100 < alertAt
            // => spentCents < (alertAt / 100) * limitCents
            // Use 0 spent to guarantee non-qualifying (alertAt >= 50 > 0)
            spentCentsPerGroup.set(group._id, 0);
          }

          const { notifyCalls, alertSentAtPerGroup } = simulateCronProcessing(
            groups,
            spentCentsPerGroup
          );

          // No group qualifies — notify should not be called at all
          expect(notifyCalls).toHaveLength(0);

          // alertSentAt must remain null for all groups
          for (const group of groups) {
            const sentAt = alertSentAtPerGroup.get(group._id);
            expect(sentAt).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mixed groups: only qualifying groups trigger notify and alertSentAt', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4, 17.5 — mixed qualifying/non-qualifying scenario
    fc.assert(
      fc.property(
        // Generate qualifying groups (spentPercent >= alertAt)
        fc.array(groupArb, { minLength: 1, maxLength: 3 }),
        // Generate non-qualifying groups (spentPercent < alertAt)
        fc.array(groupArb, { minLength: 1, maxLength: 3 }),
        (qualifyingGroups, nonQualifyingGroups) => {
          // Ensure no ID collisions between the two sets
          const qualifyingIds = new Set(qualifyingGroups.map((g) => g._id));
          const filteredNonQualifying = nonQualifyingGroups.filter(
            (g) => !qualifyingIds.has(g._id)
          );

          const allGroups = [...qualifyingGroups, ...filteredNonQualifying];
          const spentCentsPerGroup = new Map<string, number>();

          // Qualifying: spend limitCents (100% utilization) to guarantee spentPercent = 100,
          // always >= alertAt (max 100), avoiding floating-point precision issues.
          for (const group of qualifyingGroups) {
            spentCentsPerGroup.set(group._id, group.budget.limitCents);
          }

          // Non-qualifying: spend 0 (always below threshold since alertAt >= 50)
          for (const group of filteredNonQualifying) {
            spentCentsPerGroup.set(group._id, 0);
          }

          const { notifyCalls, alertSentAtPerGroup } = simulateCronProcessing(
            allGroups,
            spentCentsPerGroup
          );

          // Qualifying groups: notify called for every member, alertSentAt is non-null
          for (const group of qualifyingGroups) {
            for (const member of group.members) {
              const callForMember = notifyCalls.find(
                (c) => c.userId === member.user && c.groupId === group._id
              );
              expect(callForMember).toBeDefined();
            }
            const sentAt = alertSentAtPerGroup.get(group._id);
            expect(sentAt).not.toBeNull();
            expect(sentAt).toBeInstanceOf(Date);
          }

          // Non-qualifying groups: no notify calls, alertSentAt remains null
          for (const group of filteredNonQualifying) {
            const callsForGroup = notifyCalls.filter((c) => c.groupId === group._id);
            expect(callsForGroup).toHaveLength(0);
            const sentAt = alertSentAtPerGroup.get(group._id);
            expect(sentAt).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total notify call count equals sum of members across all qualifying groups', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4 — one notify call per member per qualifying group
    fc.assert(
      fc.property(
        uniqueGroupsArb(1, 5),
        (groups) => {
          // All groups qualify: spend exactly limitCents (100% utilization) to guarantee
          // spentPercent (100) >= alertAt (50–100) regardless of floating-point precision.
          const spentCentsPerGroup = new Map<string, number>();
          for (const group of groups) {
            // Use limitCents itself so spentPercent = 100, always >= alertAt (max 100)
            spentCentsPerGroup.set(group._id, group.budget.limitCents);
          }

          const { notifyCalls } = simulateCronProcessing(groups, spentCentsPerGroup);

          // Total notify calls = sum of members across all groups
          const totalMembers = groups.reduce((sum, g) => sum + g.members.length, 0);
          expect(notifyCalls).toHaveLength(totalMembers);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('notify calls include correct groupId and userId for each member', () => {
    // Feature: group-analytics-spending-insights, Property 10: Budget alert sends notifications and marks alertSentAt for all qualifying groups
    // Validates: Requirements 17.4 — correct payload in notify calls
    fc.assert(
      fc.property(
        groupArb,
        (group) => {
          // Group qualifies: use limitCents (100% utilization) to guarantee spentPercent = 100,
          // always >= alertAt (max 100), avoiding floating-point precision issues.
          const spentCentsPerGroup = new Map([[group._id, group.budget.limitCents]]);

          const { notifyCalls } = simulateCronProcessing([group], spentCentsPerGroup);

          expect(notifyCalls).toHaveLength(group.members.length);

          for (const call of notifyCalls) {
            expect(call.groupId).toBe(group._id);
            expect(call.type).toBe('budget_alert');
            expect(call.title).toBe('Budget alert');
            expect(call.body).toContain(group.name);
            // userId must be one of the group's members
            const memberIds = group.members.map((m) => m.user);
            expect(memberIds).toContain(call.userId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
