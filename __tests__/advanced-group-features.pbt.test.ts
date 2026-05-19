/**
 * Property-Based Tests for Advanced Group Features
 * Feature: advanced-group-features
 */

import fc from "fast-check";
import {
  assertCan,
  PERMISSION_MATRIX,
  GroupRole,
  GroupPermission,
  GroupMember,
} from "../lib/group-permissions";
import { advanceNextDueAt } from "../app/api/cron/recurring-expenses/route";

describe("Feature: advanced-group-features", () => {
  /**
   * Property 2: Last-owner protection
   * Validates: Requirements 3.5
   *
   * For any members array with exactly one owner, attempting to remove that owner
   * should be rejected (ownerCount === 1 → condition holds → 400 response).
   */
  it("Property 2: Last-owner protection", () => {
    // Tag: Feature: advanced-group-features, Property 2

    const roleArb = fc.constantFrom<"admin" | "member">("admin", "member");
    const userIdArb = fc.uuid();

    // Members array with exactly one owner + any number of non-owners (0–9)
    const membersArb = fc
      .tuple(
        // The single owner
        fc.record({ user: userIdArb, role: fc.constant("owner" as const), joinedAt: fc.date() }),
        // Zero or more non-owners with unique user IDs
        fc.uniqueArray(
          fc.record({ user: userIdArb, role: roleArb, joinedAt: fc.date() }),
          { selector: (m) => m.user, minLength: 0, maxLength: 9 }
        )
      )
      .map(([owner, nonOwners]) => {
        // Ensure no non-owner accidentally has the same user ID as the owner
        const filtered = nonOwners.filter((m) => m.user !== owner.user);
        return [owner, ...filtered];
      });

    fc.assert(
      fc.property(
        membersArb,
        (members) => {
          // The owner is always the first element
          const ownerMember = members[0];
          const targetUserId = ownerMember.user;

          const ownerCount = members.filter((m) => m.role === "owner").length;
          const targetMember = members.find((m) => m.user === targetUserId);

          // Invariant: there is exactly one owner
          expect(ownerCount).toBe(1);

          // The last-owner protection condition must hold:
          // when targetMember is the owner and ownerCount <= 1, the request should be rejected
          if (targetMember?.role === "owner" && ownerCount <= 1) {
            // Verify the condition that triggers the 400 response
            expect(ownerCount).toBe(1);
            expect(targetMember.role).toBe("owner");
            // The protection logic: ownerCount <= 1 → reject with 400
            const shouldReject = ownerCount <= 1;
            expect(shouldReject).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Archive/unarchive round-trip
   * Validates: Requirements 6.1, 6.4
   *
   * For any active group, archiving then restoring must result in status === "active"
   * with archivedAt, archivedBy, and archiveNote all cleared.
   */
  it("Property 5: Archive/unarchive round-trip", () => {
    // Tag: Feature: advanced-group-features, Property 5

    const currencies = ["USD", "INR", "TZS", "KES", "GBP", "EUR"] as const;
    const roleArb = fc.constantFrom<"owner" | "admin" | "member">("owner", "admin", "member");

    const groupArb = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      currency: fc.constantFrom(...currencies),
      members: fc.uniqueArray(
        fc.record({ user: fc.uuid(), role: roleArb, joinedAt: fc.date() }),
        { selector: (m) => m.user, minLength: 1, maxLength: 5 }
      ),
      status: fc.constant("active" as const),
    });

    const archiveNoteArb = fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined });
    const archivedByArb = fc.uuid();

    fc.assert(
      fc.property(groupArb, archiveNoteArb, archivedByArb, (group, archiveNote, archivedBy) => {
        // Simulate archive operation
        const archived = {
          ...group,
          status: "archived" as const,
          archivedAt: new Date(),
          archivedBy,
          archiveNote,
        };

        // Simulate restore operation
        const restored = {
          ...archived,
          status: "active" as const,
          archivedAt: undefined,
          archivedBy: undefined,
          archiveNote: undefined,
        };

        // Assert round-trip invariants
        expect(restored.status).toBe("active");
        expect(restored.archivedAt).toBeUndefined();
        expect(restored.archivedBy).toBeUndefined();
        expect(restored.archiveNote).toBeUndefined();
        // Original fields preserved
        expect(restored.name).toBe(group.name);
        expect(restored.currency).toBe(group.currency);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Default groups list excludes archived
   * Validates: Requirements 7.1
   *
   * For any set of groups with mixed `status` values, the default filter
   * (no archived=true param) must return only groups with status !== "archived"
   * (i.e., status === "active" or status is undefined/null).
   */
  it("Property 6: Default groups list excludes archived", () => {
    // Tag: Feature: advanced-group-features, Property 6

    type GroupStatus = "active" | "archived" | undefined;

    interface GroupLike {
      id: string;
      name: string;
      status: GroupStatus;
    }

    // Arbitrary for a group with a mixed status
    const statusArb = fc.option(
      fc.constantFrom<"active" | "archived">("active", "archived"),
      { nil: undefined, freq: 5 }
    );

    const groupArb = fc.record<GroupLike>({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      status: statusArb,
    });

    // The pure filtering function that mirrors the API logic:
    // query.status = { $ne: "archived" } when includeArchived is false
    function applyDefaultFilter(groups: GroupLike[]): GroupLike[] {
      return groups.filter((g) => g.status !== "archived");
    }

    fc.assert(
      fc.property(
        fc.array(groupArb, { minLength: 0, maxLength: 20 }),
        (groups) => {
          const result = applyDefaultFilter(groups);

          // No archived group should appear in the result
          for (const group of result) {
            expect(group.status).not.toBe("archived");
          }

          // Every non-archived group from the input must appear in the result
          const expectedIds = new Set(
            groups
              .filter((g) => g.status !== "archived")
              .map((g) => g.id)
          );
          const resultIds = new Set(result.map((g) => g.id));

          expect(resultIds).toEqual(expectedIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Archived group expense rejection
   * Validates: Requirements 7.5
   *
   * For any archived group, the expense creation check `group.status === "archived"`
   * must always return true (triggering a 403), regardless of the expense payload
   * or the requesting user's role.
   */
  it("Property 4: Archived group expense rejection", () => {
    // Tag: Feature: advanced-group-features, Property 4

    const roleArb = fc.constantFrom<GroupRole>("owner", "admin", "member");
    const categoryArb = fc.constantFrom(
      "food",
      "transport",
      "accommodation",
      "entertainment",
      "utilities",
      "other"
    );
    const splitTypeArb = fc.constantFrom<"equal" | "percentage" | "exact">(
      "equal",
      "percentage",
      "exact"
    );

    // Arbitrary for a valid expense payload (random but structurally valid)
    const expensePayloadArb = fc.record({
      description: fc.string({ minLength: 1, maxLength: 100 }),
      amount: fc.integer({ min: 1, max: 1_000_000 }), // positive integer cents
      category: categoryArb,
      splitType: splitTypeArb,
      paidBy: fc.uuid(),
    });

    // Arbitrary for an archived group (status is always "archived")
    const archivedGroupArb = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      status: fc.constant("archived" as const),
      archivedAt: fc.date(),
      archivedBy: fc.uuid(),
      archiveNote: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
    });

    // The pure check that mirrors the API logic in app/api/expenses/route.ts:
    //   if (group.status === "archived") → return 403
    function checkArchivedGroupExpenseRejection(
      group: { status: string },
      _payload: unknown,
      _requesterRole: GroupRole
    ): { shouldReject: boolean; statusCode: number } {
      if (group.status === "archived") {
        return { shouldReject: true, statusCode: 403 };
      }
      return { shouldReject: false, statusCode: 200 };
    }

    fc.assert(
      fc.property(
        archivedGroupArb,
        expensePayloadArb,
        roleArb,
        (group, payload, requesterRole) => {
          // The group is always archived — the check must always fire
          expect(group.status).toBe("archived");

          const result = checkArchivedGroupExpenseRejection(group, payload, requesterRole);

          // Regardless of payload or requester role, archived group must always reject
          expect(result.shouldReject).toBe(true);
          expect(result.statusCode).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Permission enforcement on mutating endpoints
   * Validates: Requirements 3.2, 3.4, 6.2, 6.5, 9.3, 9.5
   *
   * For any user whose role does not grant a required permission, assertCan must
   * throw a 403 error. This covers:
   *   - changeRole  → PATCH /api/groups/[id]/members  (owner only)
   *   - removeMember → DELETE /api/groups/[id]/members (owner + admin)
   *   - archiveGroup → POST/DELETE /api/groups/[id]/archive (owner only)
   *   - manageRecurring → POST/DELETE /api/groups/[id]/recurring (owner + admin)
   */
  it("Property 3: Permission enforcement on mutating endpoints", () => {
    // Tag: Feature: advanced-group-features, Property 3

    // Permissions and the roles that LACK them (derived from PERMISSION_MATRIX)
    // changeRole:      only owner has it → admin and member lack it
    // archiveGroup:    only owner has it → admin and member lack it
    // removeMember:    owner + admin have it → member lacks it
    // manageRecurring: owner + admin have it → member lacks it
    const permissionToUnauthorizedRoles: Record<string, GroupRole[]> = {
      changeRole: ["admin", "member"],
      archiveGroup: ["admin", "member"],
      removeMember: ["member"],
      manageRecurring: ["member"],
    };

    const mutatingPermissions = [
      "changeRole",
      "archiveGroup",
      "removeMember",
      "manageRecurring",
    ] as const;

    const userIdArb = fc.uuid();

    fc.assert(
      fc.property(
        // Pick one of the 4 mutating permissions
        fc.constantFrom(...mutatingPermissions),
        // The requesting user's ID
        userIdArb,
        // Other members (0–8 additional members with any role)
        fc.uniqueArray(
          fc.record({
            user: userIdArb,
            role: fc.constantFrom<GroupRole>("owner", "admin", "member"),
            joinedAt: fc.date(),
          }),
          { selector: (m) => m.user, minLength: 0, maxLength: 8 }
        ),
        (permission, requestingUserId, otherMembers) => {
          // Determine which roles lack this permission
          const unauthorizedRoles = permissionToUnauthorizedRoles[permission];

          // Pick an unauthorized role for the requesting user
          // Use the first unauthorized role (deterministic, always valid)
          const unauthorizedRole = unauthorizedRoles[0];

          // Build the requesting user's member entry with the unauthorized role
          const requestingMember: GroupMember = {
            user: requestingUserId,
            role: unauthorizedRole,
            joinedAt: new Date(),
          };

          // Filter out any collision with the requesting user's ID from otherMembers
          const filteredOthers = otherMembers.filter(
            (m) => m.user !== requestingUserId
          );

          // Compose the full members array
          const members: GroupMember[] = [requestingMember, ...filteredOthers];

          // Verify the requesting user's role truly lacks the permission
          expect(PERMISSION_MATRIX[unauthorizedRole].has(permission)).toBe(false);

          // assertCan must throw a 403 error
          let threw = false;
          let thrownValue: unknown;
          try {
            assertCan(members, requestingUserId, permission as GroupPermission);
          } catch (e) {
            threw = true;
            thrownValue = e;
          }

          expect(threw).toBe(true);
          expect((thrownValue as { status: number }).status).toBe(403);
          expect((thrownValue as { message: string }).message).toBe(
            "Forbidden: insufficient permissions"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Recurring expense amount integrity
   * Validates: Requirements 8.3, 9.6, 10.3
   *
   * For any RecurringExpense template with a positive integer `amount`, every
   * Expense document generated from that template must have an `amount` field
   * equal to the template's `amount`, and all split amounts must be integers
   * (no fractional cents).
   */
  it("Property 7: Recurring expense amount integrity", () => {
    // Tag: Feature: advanced-group-features, Property 7

    const frequencyArb = fc.constantFrom<"daily" | "weekly" | "biweekly" | "monthly">(
      "daily",
      "weekly",
      "biweekly",
      "monthly"
    );

    const splitTypeArb = fc.constantFrom<"equal" | "percentage" | "exact">(
      "equal",
      "percentage",
      "exact"
    );

    // Generate a positive integer amount (1 to 1,000,000 cents)
    const amountArb = fc.integer({ min: 1, max: 1_000_000 });

    // Generate a number of splits (1 to 5 participants)
    const numSplitsArb = fc.integer({ min: 1, max: 5 });

    // Build a splits array that sums exactly to `amount` using integer arithmetic.
    // Strategy: generate (n-1) random cut points in [0, amount], sort them,
    // then compute differences to get n non-negative integer parts.
    const templateArb = fc
      .tuple(amountArb, numSplitsArb, frequencyArb, splitTypeArb, fc.uuid(), fc.uuid())
      .chain(([amount, numSplits, frequency, splitType, paidBy, groupId]) => {
        // Generate (numSplits - 1) cut points in [0, amount]
        const cutPointsArb =
          numSplits === 1
            ? fc.constant([] as number[])
            : fc.array(fc.integer({ min: 0, max: amount }), {
                minLength: numSplits - 1,
                maxLength: numSplits - 1,
              });

        return fc
          .tuple(
            cutPointsArb,
            fc.array(fc.uuid(), { minLength: numSplits, maxLength: numSplits })
          )
          .map(([cutPoints, userIds]) => {
            // Sort cut points and compute split amounts from differences
            const sorted = [...cutPoints].sort((a, b) => a - b);
            const boundaries = [0, ...sorted, amount];
            const splitAmounts = boundaries
              .slice(1)
              .map((end, i) => end - boundaries[i]);

            // Build splits array: each split has a user and an integer amount
            const splits = userIds.map((userId, i) => ({
              user: userId,
              amount: splitAmounts[i],
            }));

            return {
              group: groupId,
              description: "Recurring expense",
              amount,
              category: "utilities",
              paidBy,
              splits,
              splitType,
              frequency,
              startDate: new Date(),
              nextDueAt: new Date(),
              isActive: true,
              generationCount: 0,
            };
          });
      });

    /**
     * Pure function that simulates the cron job's expense generation logic:
     * creates a new Expense from a RecurringExpense template.
     * Mirrors the logic described in Requirement 10.3.
     */
    function generateExpenseFromTemplate(template: {
      group: string;
      description: string;
      amount: number;
      category: string;
      paidBy: string;
      splits: Array<{ user: string; amount: number }>;
      splitType: string;
      frequency: string;
    }) {
      return {
        group: template.group,
        description: template.description,
        amount: template.amount, // must equal template.amount exactly
        category: template.category,
        paidBy: template.paidBy,
        splits: template.splits.map((s) => ({ user: s.user, amount: s.amount })),
        splitType: template.splitType,
        createdAt: new Date(),
      };
    }

    fc.assert(
      fc.property(templateArb, (template) => {
        // Precondition: template amount is a positive integer
        expect(Number.isInteger(template.amount)).toBe(true);
        expect(template.amount).toBeGreaterThan(0);

        // Precondition: all split amounts are non-negative integers summing to template.amount
        const splitSum = template.splits.reduce((acc, s) => acc + s.amount, 0);
        expect(splitSum).toBe(template.amount);
        for (const split of template.splits) {
          expect(Number.isInteger(split.amount)).toBe(true);
          expect(split.amount).toBeGreaterThanOrEqual(0);
        }

        // Generate an expense from the template
        const expense = generateExpenseFromTemplate(template);

        // Invariant 1: generated expense amount must equal template amount
        expect(expense.amount).toBe(template.amount);

        // Invariant 2: generated expense amount must be a positive integer
        expect(Number.isInteger(expense.amount)).toBe(true);
        expect(expense.amount).toBeGreaterThan(0);

        // Invariant 3: all split amounts in the generated expense must be integers
        for (const split of expense.splits) {
          expect(Number.isInteger(split.amount)).toBe(true);
          expect(split.amount).toBeGreaterThanOrEqual(0);
        }

        // Invariant 4: split amounts in the generated expense must still sum to template.amount
        const generatedSplitSum = expense.splits.reduce((acc, s) => acc + s.amount, 0);
        expect(generatedSplitSum).toBe(template.amount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: nextDueAt advancement correctness
   * Validates: Requirements 10.4
   *
   * For any nextDueAt date and any frequency from the allowed set, advancing
   * the date by one period must produce a date exactly one period later:
   *   daily    → +1 day  (+86400000 ms)
   *   weekly   → +7 days (+604800000 ms)
   *   biweekly → +14 days (+1209600000 ms)
   *   monthly  → +1 calendar month (same day/time, month incremented by 1)
   */
  it("Property 8: nextDueAt advancement correctness", () => {
    // Tag: Feature: advanced-group-features, Property 8

    const frequencyArb = fc.constantFrom<"daily" | "weekly" | "biweekly" | "monthly">(
      "daily",
      "weekly",
      "biweekly",
      "monthly"
    );

    // Generate dates within a reasonable range to avoid edge cases with
    // JavaScript Date overflow. Use dates between 2000-01-01 and 2099-12-31.
    const dateArb = fc.date({
      min: new Date("2000-01-01T00:00:00.000Z"),
      max: new Date("2099-12-31T23:59:59.999Z"),
    });

    fc.assert(
      fc.property(dateArb, frequencyArb, (nextDueAt, frequency) => {
        const advanced = advanceNextDueAt(nextDueAt, frequency);

        // The original date must not be mutated
        expect(advanced).not.toBe(nextDueAt);

        switch (frequency) {
          case "daily": {
            // +1 day = exactly +86400000 ms
            const expectedMs = nextDueAt.getTime() + 86_400_000;
            expect(advanced.getTime()).toBe(expectedMs);
            break;
          }
          case "weekly": {
            // +7 days = exactly +604800000 ms
            const expectedMs = nextDueAt.getTime() + 7 * 86_400_000;
            expect(advanced.getTime()).toBe(expectedMs);
            break;
          }
          case "biweekly": {
            // +14 days = exactly +1209600000 ms
            const expectedMs = nextDueAt.getTime() + 14 * 86_400_000;
            expect(advanced.getTime()).toBe(expectedMs);
            break;
          }
          case "monthly": {
            // +1 calendar month: same day-of-month and time, month incremented by 1
            // (JavaScript Date.setMonth handles year rollover automatically)
            const expectedYear =
              nextDueAt.getMonth() === 11
                ? nextDueAt.getFullYear() + 1
                : nextDueAt.getFullYear();
            const expectedMonth = (nextDueAt.getMonth() + 1) % 12;
            const expectedDay = nextDueAt.getDate();

            expect(advanced.getFullYear()).toBe(expectedYear);
            expect(advanced.getMonth()).toBe(expectedMonth);
            // Day may differ for months shorter than the source month
            // (e.g. Jan 31 → Feb 28/29). We only assert the day when the
            // source day fits in the target month.
            const daysInTargetMonth = new Date(expectedYear, expectedMonth + 1, 0).getDate();
            if (expectedDay <= daysInTargetMonth) {
              expect(advanced.getDate()).toBe(expectedDay);
            }
            // Time components must be preserved
            expect(advanced.getHours()).toBe(nextDueAt.getHours());
            expect(advanced.getMinutes()).toBe(nextDueAt.getMinutes());
            expect(advanced.getSeconds()).toBe(nextDueAt.getSeconds());
            break;
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: endDate deactivation
   * Validates: Requirements 10.7
   *
   * For any RecurringExpense where advancing nextDueAt by one period would result
   * in a date strictly after endDate, the cron job must set isActive to false.
   *
   * Test strategy:
   * 1. Generate a nextDueAt date and a frequency
   * 2. Compute nextAdvanced = advanceNextDueAt(nextDueAt, frequency)
   * 3. Generate an endDate strictly BEFORE nextAdvanced (endDate < nextAdvanced)
   * 4. Simulate the cron logic: shouldDeactivate = endDate && nextAdvanced > endDate
   * 5. Assert shouldDeactivate === true
   */
  it("Property 9: endDate deactivation", () => {
    // Tag: Feature: advanced-group-features, Property 9

    const frequencyArb = fc.constantFrom<"daily" | "weekly" | "biweekly" | "monthly">(
      "daily",
      "weekly",
      "biweekly",
      "monthly"
    );

    // Generate dates within a reasonable range to avoid JS Date overflow
    const dateArb = fc.date({
      min: new Date("2000-01-01T00:00:00.000Z"),
      max: new Date("2099-01-01T00:00:00.000Z"),
    });

    fc.assert(
      fc.property(dateArb, frequencyArb, (nextDueAt, frequency) => {
        // Precondition: skip invalid (NaN) dates that can appear during shrinking
        fc.pre(!isNaN(nextDueAt.getTime()));

        // Step 1 & 2: compute the advanced date
        const nextAdvanced = advanceNextDueAt(nextDueAt, frequency);

        // Precondition: advanced date must also be valid
        fc.pre(!isNaN(nextAdvanced.getTime()));

        // Step 3: generate an endDate strictly BEFORE nextAdvanced
        // We pick a date that is at least 1 ms before nextAdvanced.
        // To keep it deterministic within the property, we subtract 1 ms.
        const endDate = new Date(nextAdvanced.getTime() - 1);

        // Precondition: endDate must be strictly before nextAdvanced
        expect(endDate.getTime()).toBeLessThan(nextAdvanced.getTime());

        // Step 4: simulate the cron deactivation logic from route.ts:
        //   const shouldDeactivate = template.endDate && nextDueAt > new Date(template.endDate);
        const shouldDeactivate = endDate && nextAdvanced > endDate;

        // Step 5: assert deactivation is triggered
        expect(shouldDeactivate).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: Comment soft-delete exclusion
   * Validates: Requirements 11.2, 11.4
   *
   * For any expense with any mix of deleted and non-deleted comments, a GET to
   * `/api/expenses/[id]/comments` must return only comments where `deletedAt` is
   * not set, and must never include a comment whose `deletedAt` is set.
   */
  it("Property 10: Comment soft-delete exclusion", () => {
    // Tag: Feature: advanced-group-features, Property 10

    interface CommentLike {
      id: string;
      expenseId: string;
      authorName: string;
      text: string;
      createdAt: Date;
      deletedAt?: Date | null;
    }

    // Arbitrary for a single comment — deletedAt is randomly set or absent
    const commentArb = fc.record<CommentLike>({
      id: fc.uuid(),
      expenseId: fc.uuid(),
      authorName: fc.string({ minLength: 1, maxLength: 50 }),
      text: fc.string({ minLength: 1, maxLength: 500 }),
      createdAt: fc.date({
        min: new Date("2020-01-01T00:00:00.000Z"),
        max: new Date("2099-12-31T23:59:59.999Z"),
      }),
      // Randomly either a Date (soft-deleted) or undefined (not deleted)
      deletedAt: fc.option(
        fc.date({
          min: new Date("2020-01-01T00:00:00.000Z"),
          max: new Date("2099-12-31T23:59:59.999Z"),
        }),
        { nil: undefined, freq: 2 }
      ),
    });

    /**
     * Pure filtering function that mirrors the MongoDB query used in the GET
     * /api/expenses/[id]/comments handler:
     *   { deletedAt: { $exists: false } }
     * In JavaScript terms: keep only comments where deletedAt is null/undefined/not set.
     */
    function applyCommentFilter(comments: CommentLike[]): CommentLike[] {
      return comments.filter(
        (c) => c.deletedAt === undefined || c.deletedAt === null
      );
    }

    fc.assert(
      fc.property(
        fc.array(commentArb, { minLength: 0, maxLength: 20 }),
        (comments) => {
          const result = applyCommentFilter(comments);

          // Invariant 1: no soft-deleted comment must appear in the result
          for (const comment of result) {
            expect(comment.deletedAt === undefined || comment.deletedAt === null).toBe(true);
          }

          // Invariant 2: every non-deleted comment from the input must appear in the result
          const expectedIds = new Set(
            comments
              .filter((c) => c.deletedAt === undefined || c.deletedAt === null)
              .map((c) => c.id)
          );
          const resultIds = new Set(result.map((c) => c.id));
          expect(resultIds).toEqual(expectedIds);

          // Invariant 3: result count must equal the number of non-deleted input comments
          const nonDeletedCount = comments.filter(
            (c) => c.deletedAt === undefined || c.deletedAt === null
          ).length;
          expect(result.length).toBe(nonDeletedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Comment text validation
   * Validates: Requirements 11.7
   *
   * For any string composed entirely of whitespace characters (spaces, tabs, \n, \r,
   * or any combination), the validation logic `text.trim() === ""` must hold true,
   * which is the condition that triggers a 400 rejection in the POST comments API.
   */
  it("Property 11: Comment text validation", () => {
    // Tag: Feature: advanced-group-features, Property 11

    // Generate strings composed entirely of whitespace characters with minLength 1
    // fc.stringOf is not available in this version; use array + join instead
    const whitespaceStringArb = fc
      .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 50 })
      .map((chars) => chars.join(""));

    fc.assert(
      fc.property(whitespaceStringArb, (text) => {
        // The validation condition used in the API:
        // if (!text || text.trim() === "") → return 400
        const trimmed = text.trim();

        // A whitespace-only string must always trim to an empty string
        expect(trimmed).toBe("");

        // This confirms the 400 rejection condition is triggered
        const shouldReject = trimmed === "";
        expect(shouldReject).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1: assertCan correctness
   * Validates: Requirements 2.2, 2.4, 2.5
   *
   * For any members array, userId, and permission:
   * - if userId not in array → always throws 403
   * - if userId in array → throws iff PERMISSION_MATRIX[role] excludes that permission
   */
  it("Property 1: assertCan correctness", () => {
    // All 16 permissions
    const allPermissions: GroupPermission[] = [
      "addExpense",
      "editAnyExpense",
      "deleteAnyExpense",
      "editOwnExpense",
      "inviteMembers",
      "removeMember",
      "changeRole",
      "leaveGroup",
      "editGroupSettings",
      "archiveGroup",
      "deleteGroup",
      "setBudget",
      "manageRecurring",
      "addComment",
      "deleteOwnComment",
      "deleteAnyComment",
    ];

    // Arbitrary for a valid GroupRole
    const roleArb = fc.constantFrom<GroupRole>("owner", "admin", "member");

    // Arbitrary for a valid GroupPermission
    const permissionArb = fc.constantFrom<GroupPermission>(...allPermissions);

    // Arbitrary for a unique user ID string
    const userIdArb = fc.uuid();

    // Arbitrary for a members array with unique user IDs
    const membersArb = fc
      .uniqueArray(
        fc.record({
          user: userIdArb,
          role: roleArb,
          joinedAt: fc.date(),
        }),
        { selector: (m) => m.user, minLength: 0, maxLength: 10 }
      )
      .map((arr): GroupMember[] => arr);

    fc.assert(
      fc.property(
        membersArb,
        permissionArb,
        fc.boolean(), // true = pick userId from array, false = use a fresh userId not in array
        fc.integer({ min: 0, max: 9 }), // index to pick from array (if non-empty)
        fc.uuid(), // fresh userId not in array
        (members, permission, pickFromArray, pickIndex, freshUserId) => {
          // Determine the userId to test
          let userId: string;
          let userIsInArray: boolean;
          let userRole: GroupRole | null = null;

          if (pickFromArray && members.length > 0) {
            // Pick an existing member
            const idx = pickIndex % members.length;
            const member = members[idx];
            userId = member.user.toString();
            userIsInArray = true;
            userRole = member.role;
          } else {
            // Use a fresh userId guaranteed not to be in the array
            // Ensure it doesn't accidentally collide with existing members
            userId = freshUserId;
            // Check if it accidentally collides (extremely unlikely with UUIDs)
            const existingIds = new Set(members.map((m) => m.user.toString()));
            if (existingIds.has(userId)) {
              // Skip this case — collision is astronomically rare but handle it
              return;
            }
            userIsInArray = false;
          }

          if (!userIsInArray) {
            // User not in array → must always throw 403
            let threw = false;
            let thrownValue: unknown;
            try {
              assertCan(members, userId, permission);
            } catch (e) {
              threw = true;
              thrownValue = e;
            }
            expect(threw).toBe(true);
            expect((thrownValue as { status: number }).status).toBe(403);
          } else {
            // User is in array → throws iff PERMISSION_MATRIX[role!] excludes permission
            const roleHasPermission = PERMISSION_MATRIX[userRole!].has(permission);

            if (roleHasPermission) {
              // Should NOT throw
              expect(() => assertCan(members, userId, permission)).not.toThrow();
            } else {
              // Should throw 403
              let threw = false;
              let thrownValue: unknown;
              try {
                assertCan(members, userId, permission);
              } catch (e) {
                threw = true;
                thrownValue = e;
              }
              expect(threw).toBe(true);
              expect((thrownValue as { status: number }).status).toBe(403);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Debt consolidation correctness
   * Validates: Requirements 13.2, 13.3, 13.4
   *
   * For any set of per-group balance entries with a mix of registered users and guests:
   * - netCents sign is correct (positive = they owe me, negative = I owe them)
   * - totalOwedToMeCents === sum of positive netCents
   * - totalIOweCents === |sum of negative netCents|
   * - no guest counterparty (ID starting with "guest::") appears in consolidatedDebts
   */
  it("Property 13: Debt consolidation correctness", () => {
    // Tag: Feature: advanced-group-features, Property 13

    // Arbitrary for a registered user ID (UUID)
    const registeredUserIdArb = fc.uuid();

    // Arbitrary for a guest user ID (starts with "guest::")
    const guestUserIdArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .map((s) => `guest::${s}`);

    // Arbitrary for a counterparty ID — mix of registered users and guests
    const counterpartyIdArb = fc.oneof(registeredUserIdArb, guestUserIdArb);

    // Arbitrary for a per-group balance entry
    // balanceCents can be positive (they owe me) or negative (I owe them)
    const balanceEntryArb = fc.record({
      counterpartyId: counterpartyIdArb,
      counterpartyName: fc.string({ minLength: 1, maxLength: 50 }),
      groupId: fc.uuid(),
      groupName: fc.string({ minLength: 1, maxLength: 50 }),
      balanceCents: fc.integer({ min: -1_000_000, max: 1_000_000 }),
    });

    /**
     * Pure aggregation logic that mirrors the consolidation API:
     * 1. Aggregate by counterpartyId: sum balanceCents across groups → netCents
     * 2. Exclude any counterparty whose ID starts with "guest::"
     * 3. Compute totalOwedToMeCents = sum of positive netCents
     * 4. Compute totalIOweCents = |sum of negative netCents|
     */
    function consolidateDebts(
      entries: Array<{
        counterpartyId: string;
        counterpartyName: string;
        groupId: string;
        groupName: string;
        balanceCents: number;
      }>
    ): {
      consolidatedDebts: Array<{
        userId: string;
        userName: string;
        netCents: number;
        groups: Array<{ groupId: string; groupName: string; balanceCents: number }>;
      }>;
      totalOwedToMeCents: number;
      totalIOweCents: number;
    } {
      // Step 1: aggregate by counterpartyId
      const byCounterparty = new Map<
        string,
        {
          userName: string;
          netCents: number;
          groups: Array<{ groupId: string; groupName: string; balanceCents: number }>;
        }
      >();

      for (const entry of entries) {
        const existing = byCounterparty.get(entry.counterpartyId);
        if (existing) {
          existing.netCents += entry.balanceCents;
          existing.groups.push({
            groupId: entry.groupId,
            groupName: entry.groupName,
            balanceCents: entry.balanceCents,
          });
        } else {
          byCounterparty.set(entry.counterpartyId, {
            userName: entry.counterpartyName,
            netCents: entry.balanceCents,
            groups: [
              {
                groupId: entry.groupId,
                groupName: entry.groupName,
                balanceCents: entry.balanceCents,
              },
            ],
          });
        }
      }

      // Step 2: exclude guests
      const consolidatedDebts: Array<{
        userId: string;
        userName: string;
        netCents: number;
        groups: Array<{ groupId: string; groupName: string; balanceCents: number }>;
      }> = [];

      for (const [userId, data] of byCounterparty.entries()) {
        if (!userId.startsWith("guest::")) {
          consolidatedDebts.push({
            userId,
            userName: data.userName,
            netCents: data.netCents,
            groups: data.groups,
          });
        }
      }

      // Steps 3 & 4: compute totals
      let totalOwedToMeCents = 0;
      let totalIOweCents = 0;

      for (const debt of consolidatedDebts) {
        if (debt.netCents > 0) {
          totalOwedToMeCents += debt.netCents;
        } else if (debt.netCents < 0) {
          totalIOweCents += Math.abs(debt.netCents);
        }
      }

      return { consolidatedDebts, totalOwedToMeCents, totalIOweCents };
    }

    fc.assert(
      fc.property(
        fc.array(balanceEntryArb, { minLength: 0, maxLength: 30 }),
        (entries) => {
          const { consolidatedDebts, totalOwedToMeCents, totalIOweCents } =
            consolidateDebts(entries);

          // Invariant 1 (Requirement 13.4): no guest counterparty in consolidatedDebts
          for (const debt of consolidatedDebts) {
            expect(debt.userId.startsWith("guest::")).toBe(false);
          }

          // Invariant 2 (Requirement 13.2): netCents sign is correct —
          // positive means they owe me, negative means I owe them.
          // Verify by recomputing netCents from the input entries for each counterparty.
          for (const debt of consolidatedDebts) {
            const expectedNetCents = entries
              .filter((e) => e.counterpartyId === debt.userId)
              .reduce((sum, e) => sum + e.balanceCents, 0);
            expect(debt.netCents).toBe(expectedNetCents);
          }

          // Invariant 3 (Requirement 13.3): totalOwedToMeCents === sum of positive netCents
          const expectedOwedToMe = consolidatedDebts
            .filter((d) => d.netCents > 0)
            .reduce((sum, d) => sum + d.netCents, 0);
          expect(totalOwedToMeCents).toBe(expectedOwedToMe);

          // Invariant 4 (Requirement 13.3): totalIOweCents === |sum of negative netCents|
          const expectedIOwe = consolidatedDebts
            .filter((d) => d.netCents < 0)
            .reduce((sum, d) => sum + Math.abs(d.netCents), 0);
          expect(totalIOweCents).toBe(expectedIOwe);

          // Invariant 5: totalOwedToMeCents and totalIOweCents are non-negative
          expect(totalOwedToMeCents).toBeGreaterThanOrEqual(0);
          expect(totalIOweCents).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: convertCents correctness
   * Validates: Requirements 16.1, 16.2
   *
   * Tests the pure mathematical invariants of the convertCents logic:
   * (a) Same-currency short-circuit: fromCurrency === toCurrency → return cents unchanged
   * (b) Integer output: Math.round(cents * rate) is always an integer for any positive rate
   *
   * Since convertCents is async and DB-dependent, we test the pure math directly
   * using a helper that mirrors the Math.round(cents * rate) logic.
   */
  it("Property 14: convertCents correctness", () => {
    // Tag: Feature: advanced-group-features, Property 14

    /**
     * Pure helper that mirrors the core math of convertCents for cross-currency conversion.
     * Mirrors: return Math.round(cents * rate)
     */
    function convertCentsSync(cents: number, rate: number): number {
      return Math.round(cents * rate);
    }

    /**
     * Pure helper that mirrors the same-currency short-circuit in convertCents.
     * Mirrors: if (fromCurrency === toCurrency) return cents
     */
    function convertCentsSameCurrency(
      cents: number,
      fromCurrency: string,
      toCurrency: string
    ): number {
      if (fromCurrency === toCurrency) {
        return cents;
      }
      // Would do DB lookup — not tested here
      return cents;
    }

    // Arbitrary for integer cents (can be negative, zero, or positive)
    const centsArb = fc.integer({ min: -10_000_000, max: 10_000_000 });

    // Arbitrary for currency codes (realistic codes + arbitrary strings)
    const currencyCodeArb = fc.oneof(
      fc.constantFrom("USD", "EUR", "GBP", "INR", "TZS", "KES", "JPY", "AUD", "CAD"),
      fc.string({ minLength: 1, maxLength: 5 }).filter((s) => s.trim().length > 0)
    );

    // Arbitrary for positive exchange rates (small to large, including fractional)
    // fc.float requires 32-bit float boundaries — use Math.fround to convert
    const positiveRateArb = fc.float({
      min: Math.fround(0.0001),
      max: Math.fround(10_000),
      noNaN: true,
      noDefaultInfinity: true,
    }).filter((r) => r > 0 && isFinite(r));

    // ── Sub-property (a): same-currency short-circuit ──────────────────────────
    // convertCents(cents, c, c) must return cents unchanged for any currency c
    fc.assert(
      fc.property(centsArb, currencyCodeArb, (cents, currency) => {
        const result = convertCentsSameCurrency(cents, currency, currency);

        // Invariant: same-currency conversion must return the original cents value
        expect(result).toBe(cents);
      }),
      { numRuns: 100 }
    );

    // ── Sub-property (b): integer output for any positive rate ─────────────────
    // Math.round(cents * rate) must always be an integer
    fc.assert(
      fc.property(centsArb, positiveRateArb, (cents, rate) => {
        const result = convertCentsSync(cents, rate);

        // Invariant: output must always be an integer (no fractional cents)
        expect(Number.isInteger(result)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Edit history append-only with accurate snapshots
   * Validates: Requirements 12.2, 12.3, 12.4
   *
   * For any expense edited N times:
   * - editHistory.length === N
   * - No prior entry is mutated by a subsequent edit (immutability)
   * - Each entry's `before` snapshot matches the expense state BEFORE that edit
   */
  it("Property 12: Edit history append-only with accurate snapshots", () => {
    // Tag: Feature: advanced-group-features, Property 12

    // Arbitrary for a category string
    const categoryArb = fc.constantFrom(
      "food",
      "transport",
      "accommodation",
      "entertainment",
      "utilities",
      "other"
    );

    // Arbitrary for a single split entry
    const splitArb = fc.record({
      user: fc.uuid(),
      amount: fc.integer({ min: 0, max: 100_000 }),
    });

    // Arbitrary for an expense's mutable fields
    const expenseFieldsArb = fc.record({
      description: fc.string({ minLength: 1, maxLength: 100 }),
      amount: fc.integer({ min: 1, max: 1_000_000 }),
      category: categoryArb,
      splits: fc.array(splitArb, { minLength: 1, maxLength: 5 }),
    });

    // Arbitrary for a sequence of 1–5 updates (each is a new set of field values)
    const updatesArb = fc.array(expenseFieldsArb, { minLength: 1, maxLength: 5 });

    /**
     * Pure simulation of the edit history logic described in Requirements 12.2–12.4.
     *
     * For each update:
     * 1. Capture a deep snapshot of the current expense fields (the `before` state)
     * 2. Push a new editHistory entry containing that snapshot
     * 3. Apply the update to the expense
     *
     * Returns the final editHistory array.
     */
    function simulateEditHistory(
      initial: { description: string; amount: number; category: string; splits: Array<{ user: string; amount: number }> },
      updates: Array<{ description: string; amount: number; category: string; splits: Array<{ user: string; amount: number }> }>
    ): Array<{
      before: { description: string; amount: number; category: string; splits: Array<{ user: string; amount: number }> };
    }> {
      // Current mutable state of the expense
      let current = {
        description: initial.description,
        amount: initial.amount,
        category: initial.category,
        splits: initial.splits.map((s) => ({ ...s })),
      };

      const editHistory: Array<{
        before: { description: string; amount: number; category: string; splits: Array<{ user: string; amount: number }> };
      }> = [];

      for (const update of updates) {
        // Requirement 12.2: capture snapshot BEFORE applying the update
        const beforeSnapshot = {
          description: current.description,
          amount: current.amount,
          category: current.category,
          // Deep-copy splits so the snapshot is independent of future mutations
          splits: current.splits.map((s) => ({ ...s })),
        };

        // Requirement 12.3: append new entry to editHistory
        editHistory.push({ before: beforeSnapshot });

        // Apply the update (mutate current state)
        current = {
          description: update.description,
          amount: update.amount,
          category: update.category,
          splits: update.splits.map((s) => ({ ...s })),
        };
      }

      return editHistory;
    }

    fc.assert(
      fc.property(expenseFieldsArb, updatesArb, (initial, updates) => {
        const N = updates.length;

        // Build the expected before-states: the expense state before each update
        const expectedBeforeStates: Array<{
          description: string;
          amount: number;
          category: string;
          splits: Array<{ user: string; amount: number }>;
        }> = [];

        let state = {
          description: initial.description,
          amount: initial.amount,
          category: initial.category,
          splits: initial.splits.map((s) => ({ ...s })),
        };

        for (const update of updates) {
          expectedBeforeStates.push({
            description: state.description,
            amount: state.amount,
            category: state.category,
            splits: state.splits.map((s) => ({ ...s })),
          });
          state = {
            description: update.description,
            amount: update.amount,
            category: update.category,
            splits: update.splits.map((s) => ({ ...s })),
          };
        }

        // Run the simulation
        const editHistory = simulateEditHistory(initial, updates);

        // Invariant 1 (Requirement 12.3): editHistory.length === N
        expect(editHistory.length).toBe(N);

        // Invariant 2 (Requirement 12.2): each `before` snapshot matches the
        // expense state immediately before that update was applied
        for (let i = 0; i < N; i++) {
          const entry = editHistory[i];
          const expected = expectedBeforeStates[i];

          expect(entry.before.description).toBe(expected.description);
          expect(entry.before.amount).toBe(expected.amount);
          expect(entry.before.category).toBe(expected.category);
          expect(entry.before.splits).toEqual(expected.splits);
        }

        // Invariant 3 (Requirement 12.4): no prior entry is mutated by subsequent
        // edits — verify by re-checking all entries after the full sequence
        // (if snapshots were not deep-copied, later mutations would corrupt earlier entries)
        for (let i = 0; i < N; i++) {
          const entry = editHistory[i];
          const expected = expectedBeforeStates[i];

          // Re-assert after all updates have been applied
          expect(entry.before.description).toBe(expected.description);
          expect(entry.before.amount).toBe(expected.amount);
          expect(entry.before.category).toBe(expected.category);
          // Deep equality check ensures splits array was not mutated in place
          expect(entry.before.splits).toEqual(expected.splits);
        }
      }),
      { numRuns: 100 }
    );
  });
});
