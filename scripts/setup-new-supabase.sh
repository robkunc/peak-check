#!/bin/bash
set -e

echo "🔧 Setting up new Supabase database..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is not set"
  echo "Usage: DATABASE_URL='your-connection-string' ./scripts/setup-new-supabase.sh"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

echo "📊 Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

echo ""
echo "👥 Adding allowed users..."
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/add-allowed-user.ts robkunc@gmail.com
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/add-allowed-user.ts omarpatel123@gmail.com

echo ""
echo "✅ Database setup complete!"
echo ""
echo "🎉 You can now:"
echo "   1. Add this DATABASE_URL to Render environment variables"
echo "   2. Deploy to Render"
echo "   3. Test authentication"
