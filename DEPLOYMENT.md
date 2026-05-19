# SplitEasy – Deployment & Environment Configuration Guide

This guide covers everything you need to configure the environment variables and deploy SplitEasy to production, with a focus on the email system.

---

## Table of Contents

1. [Environment Variables Overview](#environment-variables-overview)
2. [RESEND_API_KEY – Email Service](#resend_api_key--email-service)
3. [CRON_SECRET – Cron Job Authentication](#cron_secret--cron-job-authentication)
4. [EMAIL_FROM – Sender Address & Domain Verification](#email_from--sender-address--domain-verification)
5. [SUPPORT_EMAIL – Support Contact Address](#support_email--support-contact-address)
6. [NEXT_PUBLIC_APP_URL – Application URL](#next_public_app_url--application-url)
7. [Example .env.local Configuration](#example-envlocal-configuration)
8. [Vercel Production Setup](#vercel-production-setup)
9. [Development vs Production Differences](#development-vs-production-differences)

---

## Environment Variables Overview

| Variable             | Required | Description                                      |
|----------------------|----------|--------------------------------------------------|
| `RESEND_API_KEY`     | Yes      | Resend API key for sending transactional emails  |
| `CRON_SECRET`        | Yes      | Secret for authenticating cron job requests      |
| `EMAIL_FROM`         | No       | Sender address (defaults to `noreply@spliteasy.app`) |
| `SUPPORT_EMAIL`      | No       | Support contact address shown in emails          |
| `NEXT_PUBLIC_APP_URL`| Yes      | Full URL of the app (used in email links)        |

---

## RESEND_API_KEY – Email Service

### What it does

`RESEND_API_KEY` authenticates requests to the [Resend](https://resend.com) email API. Without a valid key, all email sending is silently skipped (no-op mode).

### No-op behavior

When `RESEND_API_KEY` is set to the placeholder value `re_placeholder`, the email system enters **no-op mode**:

- Emails are **silently skipped** — no error is thrown
- A log message is printed: `[email] No-op (RESEND_API_KEY not configured): ...`
- The application continues to function normally without emails

This is intentional — it lets you run the app locally without configuring email, and prevents crashes if the key is missing.

> **Note:** Only the exact string `re_placeholder` triggers no-op mode. Any other value (including other placeholder-like strings) will be treated as a real API key.

### Key format

Resend API keys always start with `re_` followed by alphanumeric characters:

```
re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### How to obtain a Resend API key

1. Sign up or log in at [resend.com](https://resend.com)
2. Navigate to **API Keys** in the left sidebar
3. Click **Create API Key**
4. Give it a name (e.g., `spliteasy-production`)
5. Select the appropriate permission level:
   - **Sending access** is sufficient for transactional emails
   - **Full access** if you also need to manage domains via API
6. Copy the key — it is only shown once

### Configuration

```bash
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## CRON_SECRET – Cron Job Authentication

### What it does

`CRON_SECRET` protects the budget alerts cron endpoint (`/api/cron/budget-alerts`) from unauthorized access. Every cron request must include this secret in the `x-cron-secret` header.

### Security requirements

- **Minimum length:** 32 characters (64 hex characters recommended)
- **Generation method:** Cryptographically secure random generation
- **Never commit** this value to version control

### Generating a secure secret

Use `openssl` to generate a cryptographically secure 256-bit random secret:

```bash
openssl rand -hex 32
```

Example output (do not use this value):
```
7f3d8e9a2b1c4f6e8d9a3b5c7e1f4a6b8c9d2e5f7a1b3c5d7e9f1a3b5c7d9e1f3
```

The output is 64 hexadecimal characters, representing 32 bytes (256 bits) of entropy — well above the minimum requirement.

### Configuration

```bash
# .env.local
CRON_SECRET=7f3d8e9a2b1c4f6e8d9a3b5c7e1f4a6b8c9d2e5f7a1b3c5d7e9f1a3b5c7d9e1f3
```

### Setting in Vercel

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings → Environment Variables**
3. Add `CRON_SECRET` with your generated value
4. Set the environment to **Production** and **Preview** (not needed for Development unless testing cron locally)
5. Click **Save**
6. Redeploy the project to apply the new variable

### How Vercel cron jobs use it

Vercel automatically injects the `x-cron-secret` header when invoking cron routes defined in `vercel.json`. The budget alerts cron is already configured:

```json
{
  "crons": [
    {
      "path": "/api/cron/budget-alerts",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs every 6 hours. No additional configuration is needed beyond setting the `CRON_SECRET` environment variable.

### Security best practices

- Rotate the secret periodically (e.g., every 90 days)
- Use a different secret for each environment (production vs preview)
- Never log or expose the secret in error messages

---

## EMAIL_FROM – Sender Address & Domain Verification

### What it does

`EMAIL_FROM` sets the sender address that appears in the "From" field of all outgoing emails. It must be a domain that is verified in your Resend account.

### Default fallback

If `EMAIL_FROM` is not set, the email system falls back to:

```
SplitEasy <noreply@spliteasy.app>
```

> **Important:** This fallback domain (`spliteasy.app`) must be verified in Resend for production use. For development, use Resend's test domain instead (see below).

### Option 1: Resend test domain (recommended for development)

Resend provides a shared test domain `onboarding@resend.dev` that works immediately without any verification:

```bash
# .env.local (development)
EMAIL_FROM=SplitEasy <onboarding@resend.dev>
```

**Pros:**
- No setup required — works immediately
- Free tier is sufficient for testing
- Great for local development and CI

**Cons:**
- Not suitable for production (deliverability limitations)
- Cannot customize the sender domain
- Emails may be filtered as spam by some providers

### Option 2: Custom domain (required for production)

For production, verify your own domain in Resend so emails come from your branded address.

#### Steps to verify a custom domain

1. Log in to the [Resend Dashboard](https://resend.com)
2. Navigate to **Domains → Add Domain**
3. Enter your domain (e.g., `spliteasy.app`)
4. Resend will provide DNS records to add to your domain registrar

#### Required DNS records

Add the following records at your domain registrar (exact values are provided by Resend):

| Type | Name              | Value                                      | Purpose                    |
|------|-------------------|--------------------------------------------|----------------------------|
| TXT  | `_resend`         | `resend-verification=xxxxx`                | Domain ownership proof     |
| TXT  | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN...`     | DKIM email authentication  |

> DNS propagation typically takes 5–15 minutes, but can take up to 48 hours.

5. Return to the Resend dashboard and click **Verify** — the domain status will show **Verified** once DNS records are detected
6. Configure `EMAIL_FROM` with your verified domain:

```bash
# .env.local (production)
EMAIL_FROM=SplitEasy <noreply@spliteasy.app>
```

#### Fallback behavior when domain is not verified

If you configure `EMAIL_FROM` with an unverified domain, Resend will reject the send request and the email system will:

1. Catch the error from the Resend API
2. Log it: `[email] Send failed: ...`
3. Return silently — the application continues without crashing

To avoid this, either use the Resend test domain during development or ensure your custom domain is verified before deploying to production.

---

## SUPPORT_EMAIL – Support Contact Address

### What it does

`SUPPORT_EMAIL` is the reply-to or contact address shown in email footers and support-related content. It does not need to be a verified sending domain.

### Configuration

```bash
# .env.local
SUPPORT_EMAIL=support@spliteasy.app
```

If not set, email templates may fall back to a generic support reference. This variable is optional but recommended for production.

---

## NEXT_PUBLIC_APP_URL – Application URL

### What it does

`NEXT_PUBLIC_APP_URL` is the base URL of the application. It is used to generate links inside emails (e.g., "View Group" buttons, password reset links, invite links).

### Configuration

```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production
NEXT_PUBLIC_APP_URL=https://spliteasy.app

# Vercel Preview
NEXT_PUBLIC_APP_URL=https://your-preview-url.vercel.app
```

> This variable is prefixed with `NEXT_PUBLIC_` so it is available in both server and client code.

---

## Example .env.local Configuration

Copy this template and fill in your values:

```bash
# ─── Database ────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/spliteasy?retryWrites=true&w=majority

# ─── Authentication ──────────────────────────────────────────────────────────
JWT_SECRET=your-super-long-random-secret-key-here
JWT_EXPIRES_IN=7d

# ─── Email (Resend) ──────────────────────────────────────────────────────────
# Get your API key from https://resend.com/api-keys
# Set to 're_placeholder' to disable email sending (no-op mode)
RESEND_API_KEY=re_placeholder

# Sender address — use onboarding@resend.dev for development (no verification needed)
# For production, use a verified domain address
EMAIL_FROM=SplitEasy <onboarding@resend.dev>

# Support contact shown in email footers
SUPPORT_EMAIL=support@spliteasy.app

# ─── Cron Jobs ───────────────────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
# Minimum 32 characters required
CRON_SECRET=your_cron_secret_here

# ─── Application ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Vercel Production Setup

### Adding environment variables

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings → Environment Variables**
3. Add each variable with the appropriate environment scope:

| Variable              | Production | Preview | Development |
|-----------------------|------------|---------|-------------|
| `RESEND_API_KEY`      | ✅ Real key | ✅ Real key | ✅ Real key or `re_placeholder` |
| `CRON_SECRET`         | ✅ Generated | ✅ Generated | ❌ Not needed unless testing cron |
| `EMAIL_FROM`          | ✅ Verified domain | ✅ Test domain | ✅ Test domain |
| `SUPPORT_EMAIL`       | ✅          | ✅       | ✅           |
| `NEXT_PUBLIC_APP_URL` | ✅ Production URL | ✅ Preview URL | ✅ `http://localhost:3000` |

4. Click **Save** after adding each variable
5. **Redeploy** the project — environment variables only take effect after a new deployment

### Verifying the email system works

After deploying, use the test endpoint (development only) to verify email delivery:

```bash
# Test welcome email
curl "http://localhost:3000/api/test-email?to=your-email@example.com"

# Test budget alert email
curl "http://localhost:3000/api/test-email?to=your-email@example.com&template=budget-alert"
```

> The test endpoint is disabled in production (`NODE_ENV=production`). Use it only in development or preview environments.

---

## Development vs Production Differences

| Aspect               | Development                          | Production                              |
|----------------------|--------------------------------------|-----------------------------------------|
| `RESEND_API_KEY`     | `re_placeholder` (no-op) or real key | Real Resend API key                     |
| `EMAIL_FROM`         | `onboarding@resend.dev` (test domain)| Verified custom domain                  |
| `CRON_SECRET`        | Optional (skip cron testing)         | Required — generated with `openssl`     |
| `NEXT_PUBLIC_APP_URL`| `http://localhost:3000`              | `https://your-domain.com`               |
| Email sending        | No-op or real (depending on key)     | Always real                             |
| Test endpoint        | Available at `/api/test-email`       | Disabled (returns 403)                  |
| Cron schedule        | Manual trigger via curl              | Automatic every 6 hours via Vercel      |

### Quick start for local development

To run the app locally without email:

```bash
RESEND_API_KEY=re_placeholder  # emails are silently skipped
```

To test real email delivery locally:

```bash
RESEND_API_KEY=re_your_real_key_here
EMAIL_FROM=SplitEasy <onboarding@resend.dev>  # no domain verification needed
```

Then visit `http://localhost:3000/api/test-email?to=your-email@example.com` to send a test email.
