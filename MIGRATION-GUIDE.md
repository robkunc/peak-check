# Peak Check Application Transfer Guide

This guide outlines the steps required to fully transfer the Peak Check application to a new owner. While you have already transferred the GitHub repo, Supabase project, Render project, and environment variables, there are a few critical remaining steps to ensure the application functions correctly in the new environment.

## 1. Database Migration

You mentioned needing a script for migrating the database. Since you are using Supabase (PostgreSQL), the most reliable way to migrate *all* data (including users, sessions, historical weather data, etc.) is using the standard PostgreSQL tools `pg_dump` and `psql`.

We have created a helper script for this: `scripts/migrate-db.sh`.

### Prerequisites
- The new owner needs the **Connection String** for the **Old Database** (Source) and the **New Database** (Target).
- These connection strings should be in the format: `postgresql://user:password@host:5432/dbname?sslmode=require`.
- `pg_dump` and `psql` tools installed (usually part of PostgreSQL installation).

### Instructions
1.  Make executable: `chmod +x scripts/migrate-db.sh`
2.  Run the script: `./scripts/migrate-db.sh`
3.  Follow the prompts.

*If you prefer a code-only approach (e.g. if you don't have shell access to the DBs), you can use the existing `scripts/export-peaks-to-production.ts`, but be aware it ONLY migrates Peak and PeakSource data, not Users or History.*

## 2. Environment Variables Checklist

Ensure the new owner creates a new `.env.local` (or sets these in the Render dashboard) with updated values.

### Core
- `DATABASE_URL`: Connection string to the *new* database.
- `NEXTAUTH_URL`: The URL of the deployed application (e.g., `https://peak-check.onrender.com`).
- `NEXTAUTH_SECRET`: **Must** be rotated. Generate a new random string (e.g. `openssl rand -base64 32`).

### Authentication (Important)
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: **Cannot be transferred directly.** The new owner must:
    1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
    2.  Create a new Project (or use an existing one).
    3.  Create new OAuth Credentials.
    4.  Add the new domain to "Authorized JavaScript origins" and "Authorized redirect URIs" (e.g. `https://your-app.onrender.com/api/auth/callback/google`).
    5.  Update these variables with the new keys.

### Email (Nodemailer)
If you are using Email Sign-in (Magic Links), these must be configured with the new owner's SMTP provider (e.g., SendGrid, Resend, or Gmail):
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`

### Third-Party Services
- `FIRECRAWL_API_KEY`: If the account is personal, the new owner should sign up for Firecrawl and use their own key.

## 3. Scheduled Tasks (Cron Jobs)

The application relies on scheduled background jobs to fetch weather and land status. These are triggered via API routes protected by a secret key.

### Configuration
1.  **Generate a Secret**: Create a strong random string for `CRON_SECRET`.
2.  **Set Environment Variable**: Add `CRON_SECRET` to the Render dashboard environment variables.
3.  **Setup Scheduler**: The `render.yaml` blueprint includes cron jobs that are created automatically. If setting up manually, create Render Cron Jobs that call:
    - `[YOUR_APP_URL]/api/jobs/refresh-weather` (every 3 hours)
    - `[YOUR_APP_URL]/api/jobs/refresh-land-status` (every 6 hours)
    - `[YOUR_APP_URL]/api/jobs/refresh-road-status` (every 3 hours)
    - **Important**: You MUST include the header `Authorization: Bearer [YOUR_CRON_SECRET]`.

## 4. Final Verification
After transfer, verify:
1.  **Login**: Can you log in with Google? (Tests OAuth config)
2.  **Login**: Can you log in with Email? (Tests SMTP config)
3.  **Data**: Do you see all the peaks and history? (Tests DB migration)
4.  **Jobs**: Check Render cron job logs to see if `refresh-weather` is running successfully.
