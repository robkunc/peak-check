# Supabase Database Setup Guide

This guide will help you set up your Supabase PostgreSQL database for the Peak Conditions Assistant.

## Step 1: Get Your Supabase Connection String

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Database**
3. Scroll down to **Connection string**
4. Select **URI** format
5. Copy the connection string

**Important**: Supabase requires SSL. Make sure your connection string includes `?sslmode=require` at the end.

Example format:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

## Step 2: Update Your Connection String

If your connection string doesn't have `?sslmode=require`, add it:

**Before:**
```
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

**After:**
```
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require
```

## Step 3: Add to Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `DATABASE_URL` with your Supabase connection string (including `?sslmode=require`)
3. Make sure it's set for **All Environments** (Production, Preview, Development)

## Step 4: Deploy the Schema

### Option A: Use the Setup Script (Recommended)

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require"

# Run the setup script
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/setup-production-db.ts
```

This script will:
- Test the connection
- Push the schema
- Verify all tables were created
- Show you what's missing if anything fails

### Option B: Direct Prisma Command

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require"

# Push the schema
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

## Step 5: Verify the Setup

After running the setup, verify tables were created:

```bash
# Open Prisma Studio with production database
DATABASE_URL="your-supabase-connection-string" npx prisma studio
```

You should see these tables:
- ✅ users
- ✅ accounts
- ✅ sessions
- ✅ verification_tokens
- ✅ peaks
- ✅ peak_sources
- ✅ weather_snapshots
- ✅ land_status_snapshots
- ✅ road_status_snapshots
- ✅ manual_notes

## Troubleshooting

### Error: "SSL connection required"

**Solution**: Add `?sslmode=require` to your connection string

### Error: "Connection timeout" or "Connection refused"

**Possible causes:**
1. **IP Restrictions**: Supabase might have IP restrictions enabled
   - Go to Supabase Dashboard → Project Settings → Database → Connection Pooling
   - Check if IP restrictions are enabled
   - Either disable them or add your IP address

2. **Wrong connection string**: Make sure you're using the correct project reference
   - Check Supabase Dashboard → Project Settings → Database → Connection string

3. **Database paused**: Free tier Supabase databases pause after inactivity
   - Go to Supabase Dashboard and wake up your database if needed

### Error: "Password authentication failed"

**Solution**: 
- Get a fresh connection string from Supabase Dashboard
- Make sure you're using the correct password
- Supabase connection strings include the password in the URL

### Error: "Relation does not exist" after deployment

**Solution**: The schema wasn't pushed to production. Run the setup script again with your production `DATABASE_URL`.

## Alternative: Use Supabase SQL Editor (If db push hangs)

If `prisma db push` hangs or times out, use Supabase's SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Run this SQL to create the schema:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (NextAuth will create this, but you can pre-create it)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  "emailVerified" TIMESTAMP,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'LEADER',
  "external_auth_id" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Accounts table (NextAuth)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, "provider_account_id")
);

-- Sessions table (NextAuth)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "session_token" TEXT UNIQUE NOT NULL,
  "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL
);

-- Verification tokens table (NextAuth)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMP NOT NULL,
  UNIQUE(identifier, token)
);

-- Peaks table
CREATE TABLE IF NOT EXISTS peaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  region TEXT,
  "gps_lat" DECIMAL(10, 8),
  "gps_lng" DECIMAL(11, 8),
  elevation INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Peak sources table
CREATE TABLE IF NOT EXISTS peak_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "peak_id" UUID NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "refresh_interval_hours" INTEGER DEFAULT 6,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Weather snapshots table
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "peak_id" UUID NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  "raw_json" JSONB,
  "summary_text" TEXT,
  "fetched_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Land status snapshots table
CREATE TABLE IF NOT EXISTS land_status_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "peak_id" UUID NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
  "peak_source_id" UUID NOT NULL REFERENCES peak_sources(id) ON DELETE CASCADE,
  "raw_text" TEXT,
  "status_summary" TEXT,
  "status_code" TEXT,
  "fetched_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Road status snapshots table
CREATE TABLE IF NOT EXISTS road_status_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "peak_id" UUID NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
  "peak_source_id" UUID NOT NULL REFERENCES peak_sources(id) ON DELETE CASCADE,
  "raw_text" TEXT,
  "status_summary" TEXT,
  "status_code" TEXT,
  "fetched_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Manual notes table
CREATE TABLE IF NOT EXISTS manual_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "peak_id" UUID NOT NULL REFERENCES peaks(id) ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_peaks_slug ON peaks(slug);
CREATE INDEX IF NOT EXISTS idx_peaks_active ON peaks("is_active");
CREATE INDEX IF NOT EXISTS idx_peak_sources_peak_id ON peak_sources("peak_id");
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_peak_id ON weather_snapshots("peak_id");
CREATE INDEX IF NOT EXISTS idx_land_status_snapshots_peak_id ON land_status_snapshots("peak_id");
CREATE INDEX IF NOT EXISTS idx_road_status_snapshots_peak_id ON road_status_snapshots("peak_id");
CREATE INDEX IF NOT EXISTS idx_manual_notes_peak_id ON manual_notes("peak_id");
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

4. Click "Run" to execute the SQL
5. Verify tables were created in Supabase Dashboard → Table Editor

**Note**: This creates the basic schema. For the exact schema matching Prisma, use `prisma db push` when it works, or use Prisma Migrate.

## Next Steps

After the database is set up:

1. ✅ Add `DATABASE_URL` to Vercel environment variables
2. ✅ Fix `NEXTAUTH_URL` to include `https://`
3. ✅ Redeploy on Vercel
4. ✅ Create your first admin user by signing in
5. ✅ Update user role to ADMIN in database or via admin interface

