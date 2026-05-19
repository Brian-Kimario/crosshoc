/**
 * Unit tests for lib/balance-server.ts — balance calculation exclusion
 *
 * Validates: Requirements 2.2, 5.2
 *
 * These tests verify that:
 *  - Expenses with `isVoided: true` are excluded from balance calculations
 *    (Expense.find is called with `{ isVoided: { $ne: true } }` in the query)
 *  - Settlements with `status: "voided"` are excluded from balance calculations
 *    (Settlement.find is called with `{ status: "confirmed" }`, which naturally
 *    excludes voided settlements)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull in the modules
// ---------------------------------------------------------------------------

vi.mock('./db', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./models/Group', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('./models/Expense', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('./models/Settlement', () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock('./models/GuestSettlement', () => ({
  default: {
    find: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import Expense from './models/Expense';
import Settlement from './models/Settlement';
import GuestSettlement from './models/GuestSettlement';
import { calculateGroupBalances } from './balance-server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal lean expense document that satisfies the balance logic. */
function makeExpense(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'exp1',
    amount: 1000,
    paidBy: { _id: 'user1', name: 'Alice', email: 'alice@example.com', avatar: undefined },
    isGuest: false,
    guestId: null,
    guestName: null,
    guestShare: null,
    splits: [
      {
        user: { _id: 'user2', name: 'Bob', email: 'bob@example.com', avatar: undefined },
        amount: 500,
      },
      {
        user: { _id: 'user1', name: 'Alice', email: 'alice@example.com', avatar: undefined },
        amount: 500,
      },
    ],
    splitType: 'equal',
    ...overrides,
  };
}

/** Build a minimal lean settlement document. */
function makeSettlement(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'set1',
    amount: 500,
    fromUser: { _id: 'user2', name: 'Bob', email: 'bob@example.com', avatar: undefined },
    toUser: { _id: 'user1', name: 'Alice', email: 'alice@example.com', avatar: undefined },
    status: 'confirmed',
    ...overrides,
  };
}

/** Create a chainable mock that resolves to `docs` when `.lean()` is called. */
function chainableFindMock(docs: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(docs),
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateGroupBalances — voided expense exclusion', () => {
  const GROUP_ID = 'group123';

  beforeEach(() => {
    vi.clearAllMocks();

    // GuestSettlement always returns empty by default
    (GuestSettlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );
  });

  it('calls Expense.find with { isVoided: { $ne: true } } to exclude voided expenses', async () => {
    // Arrange: return one normal expense and no settlements
    (Expense.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([makeExpense()])
    );
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    // Act
    await calculateGroupBalances(GROUP_ID);

    // Assert: the first argument to Expense.find must include the voided filter
    expect(Expense.find).toHaveBeenCalledOnce();
    const expenseQuery = (Expense.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(expenseQuery).toMatchObject({ isVoided: { $ne: true } });
  });

  it('includes the group filter alongside the voided exclusion filter', async () => {
    (Expense.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    await calculateGroupBalances(GROUP_ID);

    const expenseQuery = (Expense.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(expenseQuery).toMatchObject({
      group: GROUP_ID,
      isVoided: { $ne: true },
    });
  });

  it('does not include a voided expense in the returned balances', async () => {
    // Only a voided expense exists — balances should be empty (no participants)
    const voidedExpense = makeExpense({ isVoided: true });

    // The real query filters at the DB level; here we simulate the DB correctly
    // returning nothing because the filter excluded the voided expense.
    (Expense.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([]) // DB returned 0 rows — voided expense was filtered out
    );
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    const balances = await calculateGroupBalances(GROUP_ID);

    // No participants → empty balance array
    expect(balances).toHaveLength(0);

    // Confirm the query that was sent would have excluded the voided expense
    const expenseQuery = (Expense.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(expenseQuery.isVoided).toEqual({ $ne: true });
  });

  it('includes a non-voided expense in the returned balances', async () => {
    (Expense.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([makeExpense()])
    );
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    const balances = await calculateGroupBalances(GROUP_ID);

    // Two participants (Alice paid, Bob owes)
    expect(balances.length).toBeGreaterThan(0);
    const alice = balances.find((b) => b.userId === 'user1');
    const bob = balances.find((b) => b.userId === 'user2');
    expect(alice).toBeDefined();
    expect(bob).toBeDefined();
    // Alice paid 1000, owes 500 → balance +500
    expect(alice!.balance).toBe(500);
    // Bob paid 0, owes 500 → balance -500
    expect(bob!.balance).toBe(-500);
  });
});

// ---------------------------------------------------------------------------

describe('calculateGroupBalances — voided settlement exclusion', () => {
  const GROUP_ID = 'group456';

  beforeEach(() => {
    vi.clearAllMocks();

    (GuestSettlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );
    // No expenses by default
    (Expense.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );
  });

  it('calls Settlement.find with { status: "confirmed" } to exclude voided settlements', async () => {
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    await calculateGroupBalances(GROUP_ID);

    expect(Settlement.find).toHaveBeenCalledOnce();
    const settlementQuery = (Settlement.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(settlementQuery).toMatchObject({ status: 'confirmed' });
  });

  it('does not include "voided" in the Settlement.find status filter', async () => {
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    await calculateGroupBalances(GROUP_ID);

    const settlementQuery = (Settlement.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The query must NOT use a filter that would include voided settlements
    // (e.g. no $in: ["confirmed", "voided"])
    expect(settlementQuery.status).toBe('confirmed');
    expect(settlementQuery.status).not.toEqual(
      expect.objectContaining({ $in: expect.arrayContaining(['voided']) })
    );
  });

  it('includes the group filter alongside the status filter', async () => {
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    await calculateGroupBalances(GROUP_ID);

    const settlementQuery = (Settlement.find as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(settlementQuery).toMatchObject({
      group: GROUP_ID,
      status: 'confirmed',
    });
  });

  it('does not count a voided settlement in balances (simulated by DB returning nothing)', async () => {
    // The DB correctly returns 0 settlements because the voided one was filtered out
    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([])
    );

    const balances = await calculateGroupBalances(GROUP_ID);

    // No expenses, no settlements → empty balances
    expect(balances).toHaveLength(0);
  });

  it('counts a confirmed settlement in balances', async () => {
    const confirmedSettlement = makeSettlement({ status: 'confirmed' });

    (Settlement.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainableFindMock([confirmedSettlement])
    );

    const balances = await calculateGroupBalances(GROUP_ID);

    // fromUser (Bob) paid 500 → balance +500; toUser (Alice) owes 500 → balance -500
    const bob = balances.find((b) => b.userId === 'user2');
    const alice = balances.find((b) => b.userId === 'user1');
    expect(bob).toBeDefined();
    expect(alice).toBeDefined();
    expect(bob!.balance).toBe(500);
    expect(alice!.balance).toBe(-500);
  });
});
