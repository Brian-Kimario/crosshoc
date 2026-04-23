````markdown
# SplitEasy – Zero-Friction Group Expense Splitter

**A modern, full-stack Next.js web app that makes splitting expenses in groups (roommates, trips, friends, families) effortless and drama-free.**

Built with **Next.js 15 (App Router)** + **MongoDB** + **basic JWT authentication**.  
No complex OAuth, no sessions, no third-party auth providers — just clean, beginner-to-intermediate friendly JWT middleware that recruiters love to see.

This project is deliberately **simple to build (MVP in 7–10 days)** yet **stands out** in 2026 portfolios because it demonstrates:

- Real multi-user/group logic
- MongoDB aggregation for smart balance calculations
- Magic-link guest access (zero signup friction)
- Production-ready structure with clear separation of concerns
- Ready-to-monetize freemium foundation

Perfect as a prompt for AI web design tools (Claude, Cursor, Grok, etc.) — just copy-paste this entire README into any AI and ask it to “build the complete app following this spec”.

---

## 🎯 The Problem It Solves

Groups still fight over “who owes what” because existing tools require downloads, sign-ups, or feel clunky.  
SplitEasy fixes this with **instant magic links** + **auto-calculated fair splits** + **beautiful mobile-first UI**.

---

## ✨ Core Features (MVP Scope)

### Must-Have (Build These First)

- **User Authentication** (Register / Login with email + password using JWT)
- **Group Management**
  - Create a new group
  - Generate shareable **magic invite link** (JWT token in URL, expires in 7 days)
- **Expense CRUD**
  - Add expense: description, amount, paidBy, split type (equal / custom percentages / custom amounts)
  - Optional receipt photo upload (Cloudinary)
- **Smart Dashboard**
  - Real-time balance summary (“You owe ₹1,240” / “They owe you ₹890”)
  - MongoDB aggregation pipeline for calculations
  - Simple CSV export
- **Guest Flow**
  - Anyone with the magic link can view the group and add expenses **without creating an account**
- **Responsive + Dark Mode** (Tailwind + shadcn/ui)

### Nice-to-Have (Add After MVP)

- Recurring expenses
- Activity log / notifications
- Basic analytics (total spent per category)
- Group settings (edit members, change ratios)

---

## 🛠 Tech Stack (Exactly as Specified)

| Layer           | Technology                                          |
| --------------- | --------------------------------------------------- |
| Framework       | Next.js 15 (App Router + Server Actions)            |
| Language        | TypeScript                                          |
| Database        | MongoDB (Atlas free tier) + Mongoose                |
| Authentication  | JSON Web Tokens (JWT) + httpOnly cookies            |
| Styling         | Tailwind CSS + shadcn/ui                            |
| File Uploads    | Cloudinary (optional)                               |
| Form Handling   | React Hook Form + Zod                               |
| State           | React Server Components + TanStack Query (optional) |
| Deployment      | Vercel (frontend + API)                             |
| Package Manager | **pnpm** (all commands updated)                     |

**No external backend server needed** — everything runs inside Next.js API routes / Server Actions.

---

## 📋 Everything You Need to Do (Step-by-Step Checklist)

### 1. Project Setup

1. Create a new Next.js app **with pnpm**:
   ```bash
   pnpm dlx create-next-app@latest spliteasy --typescript --tailwind --eslint --app --yes
   cd spliteasy
   ```
````

2. Install dependencies **with pnpm**:
   ```bash
   pnpm add mongoose jsonwebtoken bcryptjs cookie-parser cloudinary @cloudinary/react zod react-hook-form @hookform/resolvers
   pnpm add -D @types/jsonwebtoken @types/bcryptjs
   ```
3. Initialize Git and create `.gitignore` (ignore `.env`, `node_modules`, `pnpm-lock.yaml`, etc.)

### 2. MongoDB Setup

1. Create a **free MongoDB Atlas** cluster (M0)
2. Create a database named `spliteasy`
3. Whitelist your IP (0.0.0.0/0 for development)
4. Copy the connection string

### 3. Environment Variables (`.env.local`)

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/spliteasy?retryWrites=true&w=majority
JWT_SECRET=your-super-long-random-secret-key-here-2026
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Project Structure (Create These Folders)

```
app/
├── (auth)/
│   ├── login/
│   ├── register/
├── (dashboard)/
│   ├── groups/
│   ├── [groupId]/
│   └── layout.tsx
├── api/
│   ├── auth/
│   │   ├── register/route.ts
│   │   ├── login/route.ts
│   │   └── logout/route.ts
│   ├── groups/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── expenses/
│       ├── route.ts
│       └── [id]/route.ts
├── globals.css
├── layout.tsx
lib/
├── db.ts                 # Mongoose connection
├── auth.ts               # JWT middleware + helpers
├── utils.ts              # balance calculations
components/
├── ui/                   # shadcn components
├── GroupCard.tsx
├── ExpenseForm.tsx
├── BalanceTable.tsx
├── MagicLinkModal.tsx
```

### 5. Database Models (Mongoose Schemas)

Create `lib/models/` with:

- `User.ts`
- `Group.ts`
- `Expense.ts`

(Full schema details are in the **Database Schema** section below.)

### 6. Authentication Flow (Basic JWT)

- Register → hash password → create user → sign JWT → set httpOnly cookie
- Login → verify credentials → sign JWT → set cookie
- Protect routes using a `lib/auth.ts` middleware that reads the cookie or Authorization header

### 7. Implement Core API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/groups` (create group + generate invite token)
- `GET /api/groups/[id]` (public via invite token)
- `POST /api/expenses` (add expense, protected or guest token)

### 8. Frontend Pages & Components

- Landing page with “Try Demo” button (pre-filled demo group)
- Dashboard layout with sidebar
- Group list + create new group
- Group detail page (expenses list + balance)
- Beautiful receipt upload preview

### 9. Key Calculations (MongoDB Aggregation)

Create a utility function that:

- Uses `$group`, `$unwind`, and `$addFields` to calculate exact balances per user

### 10. Testing & Polish

- Test magic link flow in incognito
- Add loading states and error handling (toasts)
- Make it fully responsive
- Add dark mode toggle

### 11. Deployment

1. Push to GitHub
2. Deploy on **Vercel** (connects automatically to your repo)
3. Add environment variables in Vercel dashboard
4. Connect MongoDB Atlas (Vercel will handle it)

---

## 📊 MongoDB Schema (Copy-Paste Ready)

```ts
// User
{
  name: String,
  email: { type: String, unique: true },
  password: String, // hashed
  createdAt: Date
}

// Group
{
  name: String,
  creator: { type: Schema.Types.ObjectId, ref: 'User' },
  members: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    shareRatio: { type: Number, default: 100 } // percentage
  }],
  inviteToken: String,        // JWT token
  inviteExpiresAt: Date,
  createdAt: Date
}

// Expense
{
  group: { type: Schema.Types.ObjectId, ref: 'Group' },
  description: String,
  amount: Number,
  paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
  splits: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    amount: Number
  }],
  receiptUrl: String,
  createdAt: Date
}
```

---

## 🚀 How to Run Locally

```bash
# 1. Clone & install
git clone <your-repo>
cd spliteasy
pnpm install

# 2. Create .env.local (copy from above)

# 3. Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📈 Future / Monetization Ideas (Already Built-In)

- Freemium: Free for ≤4 people groups → Pro at ₹399/month (unlimited + receipt OCR)
- Easy to add Stripe later
- Perfect for AppSumo launch or Indie Hackers

---

## 👨‍💻 Contributing

Feel free to open issues or PRs. This is meant to be a learning + portfolio project.

## 📄 License

MIT License — free to use for personal or commercial projects.

---

**Made with ❤️ for developers who want a portfolio project that actually solves a real problem.**

Star this repo if it helped you!  
Questions? Open an issue or reach out on X @A_citezen63

---

## 🎨 UI/Frontend Design System

_(Everything from the previous UI guide remains unchanged — it is 100% compatible with pnpm. The color palette, layout, components, animations, etc. are all still valid.)_

**All package-related commands in this README have been updated to pnpm.**  
You can now safely copy-paste this entire file as your `README.md` and start building with `pnpm` from the very first command.

**Pro tip for AI prompting (still works perfectly):**  
Paste the entire README into Cursor/Claude/Grok and say:

> “Build the complete Next.js 15 app using App Router, TypeScript, Tailwind, shadcn/ui, and pnpm. Follow the exact UI design system and project structure described here.”

Ready to go! Want the next piece (e.g. full `lib/auth.ts`, Mongoose models, or a specific component like `ExpenseCard.tsx`)? Just ask. 🚀

**SplitEasy UI/Frontend Design Guide**
_(Copy-paste this entire section into your README.md under a new heading “🎨 UI/Frontend Design System” — it’s written so you or any AI can turn it directly into code + Figma prompts.)_

### 1. Design Philosophy (The “Why” Behind Every Pixel)

SplitEasy should feel like **a friendly financial best friend**, not a boring banking app.

- **Tone**: Warm, approachable, playful but professional (think Notion + Venmo + Duolingo vibes).
- **Goal**: Zero cognitive load. A roommate should understand the entire dashboard in <8 seconds.
- **Core Principle**: “Make money conversations feel like a group hug.” Every screen reduces awkwardness and adds a tiny dopamine hit.
- **Mobile-first**: 70 % of users will open the magic link on their phone.
- **Dark mode by default** (with light toggle) — money apps look premium and reduce eye strain at night when groups plan trips.

### 2. Official Color Palette (2026-Modern & Energetic)

Use Tailwind + CSS variables so the whole app can be themed instantly.

```css
--primary: #10b981; /* Emerald-500 — positive money, success */
--accent: #f59e0b; /* Amber-500 — friendly alerts & highlights */
--neutral: #64748b; /* Slate-500 */
--bg: #0f172a; /* Slate-950 — deep dark background */
--card: #1e2937; /* Slate-800 — cards pop nicely */
--text: #f8fafc; /* Slate-50 */
--text-muted: #cbd5e1; /* Slate-300 */
--success: #10b981;
--danger: #ef4444; /* Only for “you owe” in red */
```

**Usage Rules**:

- Buttons & CTAs → emerald-500 with subtle hover lift (`hover:scale-105 transition-all`).
- “You owe” amounts → soft red (#ef4444) but never scary red.
- “They owe you” → emerald with a small green badge.
- Gradients: Use subtle emerald-to-amber on hero sections and success states.
- Accent dots on avatars: Different colors per group member (makes it instantly scannable).

**Logo Idea**: Simple text “SplitEasy” with a tiny split-circle icon (like a pie chart that’s 50/50). Use `lucide-react` icons everywhere for consistency.

### 3. Typography & Spacing

- **Font**: `Inter` (via Tailwind) or `Geist` (if you want that 2026 premium feel).
- Headings: `font-semibold text-2xl` or `text-3xl` with tracking-tight.
- Body: `text-base leading-relaxed`.
- Padding philosophy: Generous — `p-6` or `p-8` on cards so it never feels cramped.
- Rounded corners: `rounded-3xl` everywhere (feels friendly and modern).

### 4. Global Layout (The Skeleton)

**Desktop**:

- Left sidebar (fixed, 280px) → Groups list + “+ New Group” floating button.
- Main content area (flex-1) with subtle top navbar (user avatar + group name + magic link button).
- Right panel (optional on wide screens) → Quick balance summary or activity feed.

**Mobile**:

- Bottom navigation bar (Home / Groups / Activity / Profile).
- Top sheet for “New Expense” (slides up like iOS).
- Everything stacks vertically with generous white space.

**Responsive breakpoints** (Tailwind defaults are perfect):

- `sm:` → phone
- `md:` → tablet
- `lg:` → desktop

### 5. Key Screen Descriptions (Ready for AI or Manual Build)

#### Landing Page (Public)

- Hero: Big headline “Stop fighting over bills. Start splitting easier.”
- Subheadline with 3 emojis: “📸 Snap receipt → 🤖 Auto-split → 💸 Get paid instantly”.
- Visual: Floating cards of sample expenses + avatars orbiting a central group icon (use subtle CSS animation).
- One-click “Try Demo Group” button (preloads a Goa Trip example).
- Trust signals at bottom: “Used by 10k+ roommates & travelers”.

#### Login / Register Pages

- Centered card with soft shadow.
- Background: Very subtle repeating pattern of tiny split icons (opacity 5%).
- Social-proof micro-copy: “Join 47 groups today”.

#### Dashboard (After Login)

- Greeting: “Good morning, Brian 👋 Your groups this week”
- Horizontal scroll of **Group Cards** (beautiful glassmorphic cards):
  - Top: Group name + emoji (user can pick one).
  - Middle: 4 tiny circular avatars (with colored rings).
  - Bottom: “₹12,450 spent • 8 expenses • Next settlement in 3 days” + progress bar.
- Big “+ Create New Group” card with dashed border and emerald accent.

#### Group Detail Page (The Heart of the App)

**Layout**: Two-column on desktop, stacked on mobile.

- **Left (70%) – Expense Feed**
  - Each expense is a **receipt-style card** (creative touch!):
    - Top-left: Date + small receipt icon.
    - Description in bold.
    - Amount in huge font.
    - “Paid by @rahul” with avatar.
    - Split breakdown as tiny colored bars (like a mini pie).
    - Hover: subtle lift + “Edit / Delete” appears.
- **Right (30%) – Live Balance Panel**
  - Title: “Who owes what right now”
  - Beautiful vertical list:
    - Avatar → Name → “Owes you ₹840” (green) or “You owe ₹320” (soft red).
    - Tiny “Settle” button that opens UPI/Stripe sheet (future-proof).
  - Creative visual: A **split pie chart** (Chart.js or Recharts) that animates on load showing total balance.

**Magic Link Guest View** (No login):

- Header banner: “You’re viewing ‘Goa Trip 2026’ as a guest ✨”
- Same expense feed but read-only + prominent “Add your expense” floating button (green).
- Top-right: “Claim this group & get full access” (one-click register).

### 6. Creative & Delightful Touches (What Makes It Stand Out)

1. **Micro-animations** (Framer Motion or Tailwind transitions):
   - Confetti burst when someone settles a debt.
   - Expense card “pops” in with scale + rotate when added.
   - Balance numbers count up (use `react-countup`).

2. **Avatars with personality**:
   - Upload your own or pick from 20 fun illustrated avatars (use `https://api.dicebear.com` for free).
   - Each member gets a unique colored ring that matches their “share ratio”.

3. **Receipt Cam Magic**:
   - Camera button opens device camera (or file upload).
   - After upload → loading skeleton that turns into a beautiful parsed receipt preview with editable fields.

4. **Empty States That Don’t Suck**:
   - First group: Big friendly illustration + “Create your first group in 10 seconds” + ghost emoji.

5. **Gamification Lite**:
   - Small “Harmony Score” badge on each group (out of 100) with emoji (😎 98% = “Drama-free legend”).

### 7. shadcn/ui + Tailwind Component Recommendations

- `Card`, `Button`, `Input`, `Dialog`, `Sheet`, `Avatar`, `Badge`, `Table`, `Tabs`.
- Custom:
  - `ExpenseCard.tsx` (receipt style)
  - `BalanceRow.tsx`
  - `MagicLinkButton.tsx` (copies link + shows toast “Link copied — share with group!”).

**Global styles** (add to `globals.css`):

```css
@layer base {
  :root {
    --primary: 16 185 129; /* emerald */
  }
}
```

### 8. Accessibility & Convenience Checklist

- All buttons have `aria-label`.
- Keyboard navigation works out of the box with shadcn.
- High contrast (WCAG AA).
- Toast notifications for every action (use `sonner`).
- One-tap “Copy magic link” + WhatsApp share button on mobile.

This UI will make recruiters stop scrolling and say “This actually feels like a real product I would use.”

**Pro tip for AI prompting**: Paste the entire previous README + this UI guide into Cursor/Claude and say:

> “Build the complete Next.js 15 app using App Router, TypeScript, Tailwind, shadcn/ui, and the exact UI design system described below. Make it beautiful, mobile-first, and delightful.”

Want me to generate the exact Tailwind component code for the **ExpenseCard** or the **Balance Panel** next? Or a Figma-style text wireframe for any specific screen? Just say which one! 🚀
