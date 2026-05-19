# Phase 2: Backend & Authentication - Complete ✅

## What's Been Built

### 1. Environment Configuration

- ✅ `.env.local` template with detailed comments for:
  - MongoDB URI
  - JWT secrets and expiration
  - Base URLs
  - Cloudinary (optional)

### 2. Database Layer

- ✅ `lib/db.ts` — MongoDB connection with pooling
- ✅ `lib/models/User.ts` — User schema with validation
- ✅ `lib/models/Group.ts` — Group schema with members
- ✅ `lib/models/Expense.ts` — Expense schema with splits

### 3. Authentication System

- ✅ `lib/auth.ts` — Complete auth utilities:
  - Password hashing (bcryptjs)
  - JWT signing & verification
  - HttpOnly cookie management
  - Auth middleware
  - Response helpers

### 4. API Routes (All Protected)

- ✅ `POST /api/auth/register` — Create user account
- ✅ `POST /api/auth/login` — User login
- ✅ `POST /api/auth/logout` — Clear session
- ✅ `GET /api/auth/me` — Get current user info

### 5. Frontend Integration

- ✅ `app/(auth)/login/page.tsx` — Calls `/api/auth/login`
- ✅ `app/(auth)/register/page.tsx` — Calls `/api/auth/register`
- ✅ `app/(dashboard)/page.tsx` — Protected route with logout button

## How It Works

### User Registration Flow

```
1. User fills register form
2. Client: POST /api/auth/register
3. Server: Hash password → Save to MongoDB
4. Server: Sign JWT → Set httpOnly cookie
5. Client: Redirect to /dashboard
6. Dashboard fetches /api/auth/me → Shows user info
```

### User Login Flow

```
1. User fills login form
2. Client: POST /api/auth/login
3. Server: Find user → Verify password
4. Server: Sign JWT → Set httpOnly cookie
5. Client: Redirect to /dashboard
6. Dashboard fetches /api/auth/me → Shows user info
```

### Protected Routes

- Dashboard (`/dashboard`) requires valid auth cookie
- If not authenticated → redirects to `/login`
- `/api/auth/me` checks cookie and returns user

## Security Features

- ✅ Passwords hashed with bcryptjs (10 salt rounds)
- ✅ JWTs signed with secret key (expires in 7 days)
- ✅ Cookies are httpOnly (prevents XSS access)
- ✅ Secure flag on production deployments
- ✅ SameSite=lax to prevent CSRF
- ✅ MongoDB Atlas with IP whitelist

## Setup Instructions

1. **Create .env.local file** with your values:

   ```bash
   MONGODB_URI=your-mongodb-connection-string
   JWT_SECRET=your-long-random-secret
   JWT_EXPIRES_IN=7d
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

2. **Create MongoDB database**:
   - Go to https://www.mongodb.com/cloud/atlas
   - Create free M0 cluster
   - Create database named "spliteasy"
   - Whitelist your IP (0.0.0.0/0 for dev)
   - Copy connection string

3. **Run development server**:

   ```bash
   pnpm dev
   ```

4. **Test the flow**:
   - Visit http://localhost:3000
   - Click "Sign Up Free"
   - Fill in details and register
   - Should redirect to dashboard with your name
   - Click logout to clear session

## Next Phase (Phase 3)

- Group creation API
- Expense CRUD operations
- Balance calculation aggregations
- Magic link invite system
- Receipt upload (Cloudinary)

## Technology Stack

- Next.js 15 (App Router)
- MongoDB + Mongoose
- JWT for auth
- bcryptjs for passwords
- TypeScript for type safety
