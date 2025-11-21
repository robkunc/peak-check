# Fixing Supabase Connection Issues with Prisma

## Problem

You're getting this error:
```
prepared statement "s0" already exists
```

This happens because Supabase's **connection pooler** (port 6543) doesn't support prepared statements, which Prisma uses by default.

## Solution

**Use Supabase's direct connection (port 5432) instead of the pooler (port 6543) for Prisma.**

### Step 1: Get Your Direct Connection String

1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll down to **Connection string**
3. Select **URI** format
4. **Important**: Use the **direct connection** (port 5432), NOT the pooler (port 6543)

The direct connection URL looks like:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
```

Or if you have the pooler URL, change the port from `6543` to `5432`:

**Pooler URL (doesn't work with Prisma):**
```
postgres://postgres.hucfrbhxbkoufycinrhx:password@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Direct URL (works with Prisma):**
```
postgres://postgres.hucfrbhxbkoufycinrhx:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### Step 2: Update Vercel Environment Variable

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `DATABASE_URL`
3. Update it to use port `5432` instead of `6543`
4. Make sure it includes `?sslmode=require` at the end
5. Redeploy your application

### Step 3: Verify

After redeploying, try the magic link authentication again. The "prepared statement already exists" error should be gone.

## Why This Happens

- **Connection Pooler (6543)**: Uses PgBouncer, which doesn't support prepared statements. Good for high-traffic apps with many short connections.
- **Direct Connection (5432)**: Full PostgreSQL connection that supports prepared statements. Required for Prisma.

For Prisma, you **must** use the direct connection. The pooler is better for other use cases where you don't need prepared statements.

## Alternative: Use Transaction Mode

If you must use the pooler, you can configure it to use "transaction" mode instead of "session" mode, but this is more complex and the direct connection is the recommended solution.

