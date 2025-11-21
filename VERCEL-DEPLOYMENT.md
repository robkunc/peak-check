# Vercel Deployment Guide

This guide will help you deploy the Peak Conditions Assistant to Vercel.

## Prerequisites

1. A Vercel account (free tier works)
2. A PostgreSQL database (Vercel Postgres, Railway, Supabase, or Neon)
3. Email service credentials (for magic link authentication)
4. Optional: Firecrawl API key (for data scraping)

## Step 1: Push Code to GitHub

Your code should already be on GitHub. If not:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

## Step 3: Configure Environment Variables

In the Vercel project settings, add these environment variables:

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth
NEXTAUTH_URL="https://your-app.vercel.app"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Email (for magic link authentication)
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_USER="your-email@example.com"
EMAIL_SERVER_PASSWORD="your-password"
EMAIL_SERVER_PORT="587"
EMAIL_FROM="noreply@yourdomain.com"
```

### Optional Variables

```bash
# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Firecrawl API (for data scraping)
FIRECRAWL_API_KEY="your-firecrawl-api-key"

# Cron Job Secret (for background jobs)
CRON_SECRET="your-random-secret-here"
```

### Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

## Step 4: Database Setup

1. **Set up your production database:**
   - Vercel Postgres (recommended - integrates easily)
   - Railway
   - Supabase
   - Neon

2. **Run Prisma migrations:**
   ```bash
   # Locally, with production DATABASE_URL
   DATABASE_URL="your-production-database-url" npx prisma db push
   ```

   Or use Vercel's built-in database:
   - Vercel will automatically run `prisma generate` during build
   - You'll need to run `prisma db push` manually the first time

3. **Create your first admin user:**
   - Visit your deployed app: `https://your-app.vercel.app/auth/signin`
   - Sign in with your email
   - Check your email for the magic link
   - After signing in, you'll need to update your role to ADMIN in the database:
     - Use Prisma Studio: `DATABASE_URL="your-production-url" npx prisma studio`
     - Or use the admin user management page (if you have another admin)

## Step 5: Deploy

1. Click "Deploy" in Vercel
2. Wait for the build to complete
3. Check the deployment logs for any errors

## Step 6: Verify Deployment

1. Visit your app URL: `https://your-app.vercel.app`
2. Try signing in
3. Check that pages load correctly:
   - `/` - Landing page
   - `/auth/signin` - Sign in page
   - `/peaks` - Peaks list (requires auth)
   - `/admin` - Admin dashboard (requires admin role)

## Troubleshooting 404 Errors

If you're getting 404 errors on Vercel:

### 1. Check Build Logs
- Go to your Vercel project → Deployments → Click on the latest deployment
- Check the build logs for errors
- Common issues:
  - Missing environment variables
  - Database connection errors
  - Prisma client not generated

### 2. Verify Environment Variables
- Go to Project Settings → Environment Variables
- Ensure all required variables are set
- **Important**: `NEXTAUTH_URL` must match your Vercel domain (e.g., `https://your-app.vercel.app`)

### 3. Check Database Connection
- Verify `DATABASE_URL` is correct
- Test the connection locally with the production URL
- Ensure the database is accessible from Vercel's IPs

### 4. Verify Prisma Client Generation
- The `postinstall` script in `package.json` should run `prisma generate`
- Check build logs to ensure Prisma client is generated
- If not, the build will fail

### 5. Check Routing
- Next.js App Router should work automatically on Vercel
- Ensure all pages are in `src/app/` directory
- Check that API routes are in `src/app/api/` directory

### 6. Common Issues

**Issue: "Module not found: Can't resolve '@prisma/client'"**
- Solution: Ensure `postinstall` script runs `prisma generate`
- Check that `@prisma/client` is in `dependencies` (not `devDependencies`)

**Issue: "Database connection error"**
- Solution: Check `DATABASE_URL` format and credentials
- Ensure database allows connections from Vercel

**Issue: "NEXTAUTH_URL mismatch"**
- Solution: Set `NEXTAUTH_URL` to your exact Vercel domain
- Don't include trailing slashes

**Issue: "404 on all routes"**
- Solution: Check that `next.config.js` doesn't have `output: 'standalone'`
- Ensure build completes successfully
- Check Vercel function logs

## Cron Jobs

The `vercel.json` file configures cron jobs for:
- Weather refresh: Every 3 hours
- Land status refresh: Every 6 hours
- Road status refresh: Every 3 hours

These will run automatically on Vercel. Ensure `CRON_SECRET` is set if you want to protect these endpoints.

## Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Database connected and schema pushed
- [ ] First admin user created
- [ ] Sign-in flow works
- [ ] Peaks list loads
- [ ] Admin pages accessible
- [ ] API routes working
- [ ] Cron jobs configured (check Vercel dashboard)

## Support

If you continue to have issues:
1. Check Vercel deployment logs
2. Check Vercel function logs
3. Test locally with production environment variables
4. Verify all dependencies are in `package.json` (not just `devDependencies`)

