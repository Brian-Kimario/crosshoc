# Phase 4: Receipts & Balances - Complete ✅

## What's Been Built

### 1. Cloudinary Receipt Upload

- ✅ `next-cloudinary` package installed and configured
- ✅ `CldUploadWidget` integrated in expense form
- ✅ Upload preset: `spliteasy_receipts` (configurable via env)
- ✅ Support for local files and camera capture
- ✅ Receipt URL saved to `Expense.receiptUrl` field
- ✅ "View Receipt" button on expense cards (opens in new tab)
- ✅ Next.js images configured for `res.cloudinary.com`

### 2. Balance Aggregation Engine

- ✅ `lib/balance.ts` — Balance calculation utilities
- ✅ `calculateGroupBalances(groupId)` — Aggregates paid vs owed per user
- ✅ `getSimplifiedDebts(balances)` — Calculates who pays whom
- ✅ Logic: `Balance = Sum(Paid) - Sum(Owed)`
- ✅ Positive balance = user is owed money (green)
- ✅ Negative balance = user owes money (red)

### 3. Balance Display UI

- ✅ **Balance Summary Card** — Shows each member's net balance
- ✅ **"Who pays whom" Card** — Simplified settlement suggestions
- ✅ Color-coded: Emerald (gets back), Red (owes), Slate (settled)
- ✅ Avatar + name display for each member
- ✅ Real-time calculation from all group expenses

### 4. Join Flow Polish

- ✅ Guest users redirected to `/register?redirect=/join/[token]`
- ✅ After auth, redirected back to join page
- ✅ Fixed all navigation URLs for route group structure
- ✅ Consistent Emerald-500 styling throughout

## How It Works

### Receipt Upload Flow

1. User clicks "Attach Receipt" in Add Expense dialog
2. Cloudinary widget opens (local file or camera)
3. Image uploads to Cloudinary
4. URL stored in `receiptUrl` state
5. On save, URL saved to MongoDB
6. Expense card shows "View Receipt" button

### Balance Calculation

```
For each expense in group:
  - Add amount to payer's "paid" total
  - Add split.amount to each member's "owed" total

Final Balance = Paid - Owed

Example: 3 people, $30 meal
  - You paid $30 → Paid: $30, Owed: $10 → Balance: +$20 (green)
  - Alice owes $10 → Paid: $0, Owed: $10 → Balance: -$10 (red)
  - Bob owes $10 → Paid: $0, Owed: $10 → Balance: -$10 (red)
```

### Simplified Debts

Instead of complex pairwise debts, the engine suggests minimum transactions:

```
Before: A owes B $10, B owes C $5, C owes A $3
After: A pays C $2, A pays B $5
```

## Environment Variables

```env
# Cloudinary (optional - for receipt uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=spliteasy_receipts
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Testing Checklist

- [ ] Upload receipt in Add Expense dialog
- [ ] View receipt button appears on expense card
- [ ] Click "View Receipt" opens image in new tab
- [ ] Create expense in group, verify balance updates
- [ ] Balance shows green for those owed money
- [ ] Balance shows red for those who owe
- [ ] "Who pays whom" suggests correct settlements
- [ ] Join link works for guests (redirects to register)

## UI/UX Features

- ✅ Paperclip icon for receipt attachment (Lucide)
- ✅ Emerald-500 hover states on upload button
- ✅ Receipt attached indicator with remove button
- ✅ Responsive layout: expenses (70%) | balances (30%)
- ✅ Rounded-3xl cards with Slate-800 background
- ✅ Toast notifications for all actions

## Project Status

**Phase 2**: ✅ Complete (Auth & Database)
**Phase 3**: ✅ Complete (Groups & Expenses)
**Phase 4**: ✅ Complete (Receipts & Balances)

## Next Steps (Optional)

- Settle payment integration (Stripe/UPI)
- Recurring expenses
- Activity log/notifications
- Analytics dashboard
