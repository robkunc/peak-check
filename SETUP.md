# Setup Instructions

This guide will help you set up the Sierra Club Peak Conditions Assistant locally.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or cloud-hosted)
- Email service credentials (for magic link authentication)
- Optional: Google OAuth credentials

## Step 1: Clone and Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/peakcheck?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Email (for magic link auth)
EMAIL_SERVER_USER="your-email@example.com"
EMAIL_SERVER_PASSWORD="your-password"
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_FROM="noreply@example.com"

# OAuth (optional - remove from .env if not using)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Firecrawl API (for Phase 4)
FIRECRAWL_API_KEY="your-firecrawl-api-key"

# Cron Job Secret
CRON_SECRET="your-cron-secret-here"
```

### Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

### Email Service Setup

For development, you can use services like:
- [Mailtrap](https://mailtrap.io/) for testing
- [SendGrid](https://sendgrid.com/)
- [Resend](https://resend.com/)
- Gmail SMTP (with app password)

## Step 3: Set Up the Database

### Push the Prisma schema to your database:

```bash
npx prisma db push
```

This will create all the necessary tables in your PostgreSQL database.

### Open Prisma Studio to view/edit data:

```bash
npx prisma studio
```

## Step 4: Create Your First Admin User

Since the app requires authentication, you'll need to create your first admin user directly in the database.

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000/auth/signin` and sign in with your email

3. Check your email for the magic link and click it

4. Open Prisma Studio:
   ```bash
   npx prisma studio
   ```

5. Navigate to the `users` table and change your user's `role` from `LEADER` to `ADMIN`

## Step 5: Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Step 6: Add Test Data

As an admin user, you can now:

1. Navigate to `/admin` to access admin controls
2. Create peaks with names, regions, and GPS coordinates
3. Add data sources (land manager URLs, road status URLs)
4. View the peaks list at `/peaks`
5. Click on individual peaks to view conditions
6. Add manual notes

## Database Scripts

- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Prisma Studio
- `npm run db:generate` - Generate Prisma Client (usually automatic)

## Deployment

This app is designed to be deployed on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

Make sure to set up your production database (e.g., Vercel Postgres, Railway, Supabase, or Neon).

## Current Implementation Status

### ✅ Phase 1 Complete (Foundation)
- Next.js project with TypeScript and App Router
- Prisma database schema
- NextAuth with role-based authentication
- API routes for peaks CRUD
- Basic UI layout and navigation
- Peaks list page

### 🚧 Not Yet Implemented
- Phase 2: Manual notes UI enhancements
- Phase 3: Weather integration (NOAA API)
- Phase 4: Firecrawl integration for land manager & road status
- Phase 5: Admin screens for managing peaks and sources
- Phase 6: Optional enhancements

See `sierra-conditions-spec.md` for the complete implementation roadmap.


