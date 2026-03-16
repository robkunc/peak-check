# Render Deployment Guide

This guide walks you through deploying the Peak Conditions Assistant to [Render](https://render.com).

## Prerequisites

1. A Render account
2. A PostgreSQL database (keep your existing Supabase DB, or use Render's managed PostgreSQL)
3. Email service credentials (for magic link authentication)
4. Optional: Firecrawl API key (for data scraping)

## Option A: Deploy with Blueprint (Recommended)

The repo includes a `render.yaml` blueprint that auto-configures the web service and cron jobs.

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New** > **Blueprint**
4. Connect your GitHub repo
5. Render will detect `render.yaml` and show the services it will create:
   - `peak-check` — Web Service (Next.js app)
   - `refresh-weather` — Cron Job (every 3 hours)
   - `refresh-land-status` — Cron Job (every 6 hours)
   - `refresh-road-status` — Cron Job (every 3 hours)
6. Fill in the environment variables marked as `sync: false` (see below)
7. Click **Apply**

**Important:** After the first deploy, update the cron job URLs in the Render dashboard to use your actual Render URL (e.g., `https://peak-check-xxxx.onrender.com`) instead of the placeholder `https://peak-check.onrender.com`.

## Option B: Manual Setup

### 1. Create a Web Service

1. Go to Render Dashboard > **New** > **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name:** `peak-check`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Starter ($7/mo) — recommended to avoid cold starts

### 2. Set Environment Variables

In the web service settings, add:

#### Required

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
NEXTAUTH_URL="https://your-app-name.onrender.com"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# Email (for magic link auth)
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@example.com"
EMAIL_SERVER_PASSWORD="your-password"
EMAIL_FROM="noreply@yourdomain.com"
```

#### Optional

```bash
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
FIRECRAWL_API_KEY="your-firecrawl-api-key"
CRON_SECRET="your-random-secret-here"
```

### 3. Set Up Cron Jobs

For each background job, go to **New** > **Cron Job**:

| Name | Schedule | Command |
|------|----------|---------|
| refresh-weather | `0 */3 * * *` | `curl -s -X POST "https://YOUR-APP.onrender.com/api/jobs/refresh-weather" -H "Authorization: Bearer $CRON_SECRET"` |
| refresh-land-status | `0 */6 * * *` | `curl -s -X POST "https://YOUR-APP.onrender.com/api/jobs/refresh-land-status" -H "Authorization: Bearer $CRON_SECRET"` |
| refresh-road-status | `0 */3 * * *` | `curl -s -X POST "https://YOUR-APP.onrender.com/api/jobs/refresh-road-status" -H "Authorization: Bearer $CRON_SECRET"` |

Add the `CRON_SECRET` env var to each cron job (same value as the web service).

## Database Setup

### Keep Existing Supabase Database

If you already have a Supabase database with data, just use the same `DATABASE_URL`. No changes needed — Supabase is accessible from any host.

### Or Use Render PostgreSQL

1. Go to **New** > **PostgreSQL**
2. Pick a plan (free tier available for development)
3. Copy the **Internal Connection String** (if web service and DB are in the same Render region) or **External Connection String**
4. Set it as `DATABASE_URL` in your web service
5. Push the schema:
   ```bash
   DATABASE_URL="your-render-postgres-url" npx prisma db push
   ```

## First Admin User

1. Visit `https://your-app-name.onrender.com/auth/signin`
2. Sign in with your email (magic link)
3. Update your role to ADMIN in the database:
   ```bash
   DATABASE_URL="your-production-url" npx prisma studio
   ```
   Find your user and change `role` to `ADMIN`.

## Verify Deployment

1. Visit your app URL
2. Sign in and check these pages load:
   - `/` — Landing page
   - `/peaks` — Peaks list
   - `/admin` — Admin dashboard (requires ADMIN role)
3. Test a manual job refresh from the admin interface
4. Check cron jobs are running in the Render dashboard under **Cron Jobs**

## Custom Domain (Optional)

1. In your web service settings, go to **Custom Domains**
2. Add your domain
3. Update DNS records as instructed by Render
4. Update `NEXTAUTH_URL` to your custom domain

## Troubleshooting

### Build Fails with Prisma Error
- Ensure `@prisma/client` is in `dependencies` (not `devDependencies`)
- The `postinstall` script runs `prisma generate` automatically
- Check that `DATABASE_URL` is set in environment variables

### 502 Bad Gateway After Deploy
- Check the service logs in Render dashboard
- Ensure `DATABASE_URL` is correct and the database is accessible
- Verify all required env vars are set

### Auth Not Working
- Ensure `NEXTAUTH_URL` matches your exact Render URL (no trailing slash)
- Check email credentials are correct
- For Google OAuth: update the authorized redirect URI to `https://your-app.onrender.com/api/auth/callback/google`

### Cron Jobs Not Running
- Verify the cron job URL matches your actual Render web service URL
- Check that `CRON_SECRET` matches between web service and cron jobs
- Review cron job logs in the Render dashboard

### Cold Starts (Free Tier)
- Free tier services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Upgrade to Starter plan ($7/mo) for always-on service
