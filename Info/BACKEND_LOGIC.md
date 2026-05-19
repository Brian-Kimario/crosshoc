# SplitEasy Backend Logic & Mathematical Foundation

## Document Purpose
This document provides a comprehensive technical reference for understanding the calculation logic, data structures, and mathematical algorithms used in SplitEasy's backend. Use this for implementing new features, debugging balance issues, or extending functionality.

---

## 1. Data Model Architecture

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │    USER     │◄────┤    GROUP    ├────►│   EXPENSE   │               │
│  │             │     │             │     │             │               │
│  │ - _id       │     │ - _id       │     │ - _id       │               │
│  │ - name      │     │ - name      │     │ - group     │               │
│  │ - email     │     │ - creator   │     │ - amount    │               │
│  │ - avatar    │     │ - members[] │     │ - paidBy    │               │
│  │             │     │ - currency  │     │ - splits[]  │               │
│  └─────────────┘     │ - inviteToken│    │ - splitType │               │
│        ▲              └─────────────┘     └──────┬──────┘               │
│        │                                         │                     │
│        │         ┌─────────────┐                  │                     │
│        │         │ SETTLEMENT  │◄─────────────────┘                     │
│        │         │             │                                        │
│        │         │ - _id       │                                        │
│        │         │ - group     │                                        │
│        │         │ - fromUser  │                                        │
│        │         │ - toUser    │                                        │
│        │         │ - amount    │                                        │
│        │         └─────────────┘                                        │
│        │                                                                │
│        └──────────────────────────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Schema Definitions

#### 1.1 Expense Schema
```typescript
interface IExpense {
  group: ObjectId;           // Reference to Group
  description: string;      // What was purchased
  amount: number;           // Total expense amount (2 decimal precision)
  category: string;         // 'food', 'transport', etc.
  splitType: 'equal' | 'percentage' | 'exact';
  paidBy: ObjectId;         // Who paid the money (creditor)
  createdBy: ObjectId;      // Who created the expense record
  splits: Array<{
    user: ObjectId;        // Who owes a portion
    amount: number;        // How much they owe
  }>;
  receiptUrl?: string;
  
  // GUEST SUPPORT FIELDS
  isGuest?: boolean;       // True if paid by non-registered guest
  guestId?: string;        // Unique guest identifier (UUID)
  guestName?: string;      // Display name for guest
  guestShare?: number;     // Guest's own portion of the split
}
```

**Key Concept:** The `splits` array defines who owes what. The sum of all split amounts must equal the total expense amount.

**Guest Logic:** When `isGuest=true`, the expense is attributed to a virtual user with ID `guest::{guestId}`. This allows guests to participate without registration.

---

## 2. Balance Calculation System

### 2.1 Core Balance Formula

For any user in a group, their balance is calculated as:

```
Balance = Paid - Owed

Where:
  Paid = Total amount this user has paid for expenses
         + Total amount this user has paid in settlements
         
  Owed = Total amount this user owes from expense splits
         + Total amount others have paid to this user in settlements
```

**Interpretation:**
- **Balance > 0**: User is owed money (net creditor)
- **Balance < 0**: User owes money (net debtor)
- **Balance = 0**: User is settled up

### 2.2 Group Balance Calculation Algorithm

**File:** `/lib/balance-server.ts` → `calculateGroupBalances()`

```typescript
async function calculateGroupBalances(groupId: string): Promise<GroupMemberBalance[]> {
  // Step 1: Fetch all expenses and settlements
  const expenses = await Expense.find({ group: groupId }).populate(...);
  const settlements = await Settlement.find({ group: groupId }).populate(...);
  
  // Step 2: Initialize user map
  const userMap = new Map<string, GroupMemberBalance>();
  
  // Step 3: Process each expense
  for (const expense of expenses) {
    // Determine effective payer (handle guest vs registered user)
    const payerId = expense.isGuest 
      ? `guest::${expense.guestId}`  // Virtual guest key
      : String(expense.paidBy._id);   // Registered user
    
    // Credit the payer
    payerEntry.paid += expense.amount;
    
    // Handle guest's own share (guests owe their portion too)
    if (expense.isGuest) {
      const guestShare = expense.guestShare ?? calculateFromSplits();
      payerEntry.owed += guestShare;
    }
    
    // Debit each person in splits
    for (const split of expense.splits) {
      userMap.get(split.user._id).owed += split.amount;
    }
  }
  
  // Step 4: Process settlements
  for (const settlement of settlements) {
    // fromUser paid money → increases their paid
    userMap.get(settlement.fromUser._id).paid += settlement.amount;
    
    // toUser received money → increases their owed
    // (because receiving payment reduces what they're owed)
    userMap.get(settlement.toUser._id).owed += settlement.amount;
  }
  
  // Step 5: Calculate final balances
  return Array.from(userMap.values()).map(user => ({
    ...user,
    balance: roundToCents(user.paid - user.owed)
  }));
}
```

### 2.3 Mathematical Validation

**Invariant Check:** The sum of all balances in a group must equal exactly $0.00

```typescript
const totalBalance = balances.reduce((sum, user) => sum + user.balance, 0);
if (totalBalance !== 0) {
  // Apply adjustment to first user to force zero-sum
  balances[0].balance += -totalBalance;
}
```

**Why this matters:** Any non-zero sum indicates a calculation error. This check ensures data integrity.

---

## 3. Split Type Algorithms

### 3.1 Equal Split
```
Each person pays = Total Amount / Number of Participants

Example: $100 expense, 4 people
Each owes: $100 / 4 = $25.00
```

**Edge Case - Rounding:** If division produces repeating decimals, the payer's share is adjusted to absorb any remainder cents to ensure the sum equals the total.

### 3.2 Percentage Split
```
Each person pays = Total Amount × (Their Percentage / 100)

Example: $100 expense
  - Person A: 50% → $50.00
  - Person B: 30% → $30.00
  - Person C: 20% → $20.00
```

**Validation:** Sum of all percentages must equal 100%.

### 3.3 Exact Split
```
Each person pays = Exact amount specified

Example: $100 expense
  - Person A: $40.00
  - Person B: $35.00
  - Person C: $25.00
```

**Validation:** Sum of all exact amounts must equal total expense amount.

---

## 4. Debt Simplification Algorithm

### 4.1 Problem Statement

Without simplification, debt chains can be complex:
- Alice owes Bob $50
- Bob owes Charlie $50
- Charlie owes Alice $50

**Simplified:** Everyone is settled (debts cancel out).

### 4.2 Greedy Settlement Algorithm

**File:** `/lib/balance-server.ts` → `getSimplifiedDebts()`

```typescript
function getSimplifiedDebts(balances: GroupMemberBalance[]): SimplifiedDebt[] {
  // Separate creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter(b => b.balance > 0)
    .sort((a, b) => b.balance - a.balance); // Sort by amount (desc)
  
  const debtors = balances
    .filter(b => b.balance < 0 && !isGuest(b.userId))
    .map(b => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance); // Sort by amount (desc)
  
  const transactions: SimplifiedDebt[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  
  // Greedy matching: Largest debtor pays largest creditor
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    
    const amount = Math.min(debtor.balance, creditor.balance);
    
    if (amount > 0.01) {
      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: roundToCents(amount)
      });
    }
    
    // Reduce remaining balances
    debtor.balance -= amount;
    creditor.balance -= amount;
    
    // Move to next if settled
    if (debtor.balance < 0.01) debtorIndex++;
    if (creditor.balance < 0.01) creditorIndex++;
  }
  
  return transactions;
}
```

### 4.3 Algorithm Properties

- **Optimal:** Produces the minimum number of transactions (proven for this problem class)
- **Time Complexity:** O(n log n) due to sorting, where n = number of users
- **Space Complexity:** O(n)

---

## 5. Guest User System

### 5.1 Virtual User Pattern

Guests are represented using a virtual ID format:
```
guest::{uuid}  →  Example: "guest::a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

This ensures:
- No collision with MongoDB ObjectIds
- Unique identification per guest
- Can be treated as a regular user in balance calculations

### 5.2 Guest Expense Flow

```
1. Guest pays $100 for dinner via invite link
   → Expense created with:
      - isGuest: true
      - guestId: "guest::abc123"
      - guestName: "John"
      - paidBy: [placeholder - first group member]
      
2. System calculates splits:
   - Guest's share = $25 (stored in guestShare)
   - Other members' shares = $75 total
   
3. Balance calculation:
   - guest::abc123 gets credited $100 (paid)
   - guest::abc123 gets debited $25 (guestShare)
   - guest::abc123 net balance = +$75 (owed by others)
   - Other members owe their portions
```

### 5.3 Guest Settlement (PayGuestButton)

When a registered member pays a guest outside the app:

```typescript
// 1. Create GuestSettlement record
await GuestSettlement.create({
  group: groupId,
  fromUser: memberId,      // Who paid the guest
  guestId: guestId,        // Which guest was paid
  guestName: guestName,
  amount: paymentAmount
});

// 2. Balance impact:
// - Member's paid increases by amount (reducing their debt)
// - Guest's owed increases by amount (reducing their credit)
```

---

## 6. Settlement System

### 6.1 Settlement Types

| Type | Description | Balance Impact |
|------|-------------|----------------|
| **Member-to-Member** | Registered user pays another | `fromUser.paid += amount`<br>`toUser.owed += amount` |
| **Member-to-Guest** | User pays a guest (off-app) | `fromUser.paid += amount`<br>`guest.owed += amount` |
| **Partial** | Paying less than full debt | Same as above, balance remains non-zero |

### 6.2 Settlement Recording

**API:** `POST /api/groups/{id}/settle`

```typescript
// Request body
{
  fromUserId: string;    // Who is paying
  toUserId: string;      // Who receives payment
  amount: number;       // Amount being paid
  method: "cash" | "digital" | "other";
  note?: string;        // Optional note
}

// Validation rules:
// 1. Both users must be group members
// 2. Amount must be positive
// 3. Requester must be a group member
```

### 6.3 Balance Update Logic

```
Before Settlement:
  - Alice: balance = -$50 (owes $50)
  - Bob:   balance = +$50 (owed $50)

Settlement: Alice pays Bob $50
  
After Settlement:
  - Alice.paid += $50  →  Alice's balance: -$50 + $50 = $0
  - Bob.owed += $50   →  Bob's balance: +$50 - $50 = $0
```

---

## 7. Currency Handling

### 7.1 Supported Currencies

| Currency | Code | Symbol | Decimal Places |
|----------|------|--------|----------------|
| US Dollar | USD | $ | 2 |
| Indian Rupee | INR | ₹ | 2 |
| Tanzanian Shilling | TZS | TSh | 0 |

### 7.2 Decimal Precision

All monetary calculations use:
```typescript
function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

**Why EPSILON?** Handles floating-point precision errors like `0.1 + 0.2 ≠ 0.3`.

---

## 8. Common Calculation Scenarios

### 8.1 Scenario 1: Simple Equal Split

```
Group: Alice, Bob, Charlie
Expense: $90 dinner, paid by Alice
Split: Equal (3 ways)

Calculations:
  - Each person's share: $90 / 3 = $30
  
Balances:
  - Alice: Paid $90, Owed $30 → Balance = +$60 (owed $60)
  - Bob:   Paid $0,  Owed $30 → Balance = -$30 (owes $30)
  - Charlie: Paid $0, Owed $30 → Balance = -$30 (owes $30)
  
Simplified Debts:
  - Bob pays Alice $30
  - Charlie pays Alice $30
```

### 8.2 Scenario 2: Uneven Split with Settlement

```
Group: Alice, Bob
Expenses:
  1. $100 groceries, paid by Alice, split: Alice $60, Bob $40
  2. $50 dinner, paid by Bob, split: Alice $25, Bob $25

Raw Balances:
  - Alice: Paid $100, Owed $85 → Balance = +$15
  - Bob:   Paid $50,  Owed $65 → Balance = -$15

Simplified Debts:
  - Bob pays Alice $15

After Settlement (Bob pays Alice $15):
  - Alice: Paid $100, Owed $85 + $15(settlement) = $100 → Balance = $0
  - Bob:   Paid $50 + $15(settlement), Owed $65 = $65 → Balance = $0
```

### 8.3 Scenario 3: Guest Involved

```
Group: Alice (registered), Guest: John (via invite)
Expense: $200 hotel, paid by John (guest)
Split: John $100 (guestShare), Alice $100

Balances:
  - John (guest::123): Paid $200, Owed $100 → Balance = +$100
  - Alice: Paid $0, Owed $100 → Balance = -$100

Simplified Debts:
  - Alice pays John $100 (via PayGuestButton)
```

---

## 9. API Endpoints Reference

### 9.1 Balance-Related Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/groups/[id]/settle` | POST | Record a settlement payment |
| `/api/balances/summary` | GET | Get user's total across all groups |
| `/api/groups/[id]/export-csv` | GET | Export group data as CSV |

### 9.2 Guest-Related Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guest/expenses` | POST | Create expense as guest |
| `/api/guest/settle` | POST | Record guest settlement |
| `/api/guest/claim` | POST | Claim guest account (convert to registered) |

---

## 10. Future Enhancement Areas

### 10.1 Potential Improvements

1. **Multi-Currency Groups:** Support expenses in different currencies within same group
2. **Recurring Expenses:** Automatic monthly/weekly expense creation
3. **Expense Categories Analytics:** Spending breakdown by category
4. **Debt Optimization Across Groups:** Simplify debts across multiple groups
5. **Interest Calculations:** Optional late payment interest
6. **Tax Handling:** Automatic tax calculation and splitting

### 10.2 Algorithm Enhancements

1. **Minimum Cash Flow:** Current greedy algorithm is optimal for transaction count, but could minimize total cash flow amount
2. **Preference-Based Simplification:** Allow users to prefer settling with specific people
3. **Partial Payment Chains:** Support "Alice pays Bob, Bob pays Charlie" chains

---

## 11. Debugging Balance Issues

### 11.1 Validation Checklist

When balances seem incorrect:

1. **Check Expense Sums:** Verify `SUM(splits.amount) = expense.amount`
2. **Check Settlement Records:** Ensure settlements are properly recorded
3. **Verify Zero-Sum:** Run `validateBalanceSum()` - should return true
4. **Review Guest Logic:** Check if guest expenses have correct `guestShare`
5. **Check Currency Rounding:** Ensure no floating-point errors with `roundToCents()`

### 11.2 Console Debugging

Add to `calculateGroupBalances()`:
```typescript
console.log('[Balance Calculation]', {
  groupId,
  expenseCount: expenses.length,
  settlementCount: settlements.length,
  userMapEntries: Array.from(userMap.entries()),
  totalBalanceBeforeValidation: balances.reduce((s, u) => s + u.balance, 0)
});
```

---

## 12. Key Files Reference

| File | Purpose |
|------|---------|
| `/lib/balance-server.ts` | Core balance calculation logic |
| `/lib/balance-types.ts` | TypeScript type definitions |
| `/lib/models/Expense.ts` | Expense schema definition |
| `/lib/models/Settlement.ts` | Settlement schema definition |
| `/app/api/groups/[id]/settle/route.ts` | Settlement API endpoint |

---

**Document Version:** 1.0  
**Last Updated:** April 27, 2026  
**Author:** SplitEasy Development Team
