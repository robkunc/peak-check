/**
 * Script to set up production database schema
 * Run with: DATABASE_URL="your-supabase-connection-string" npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/setup-production-db.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required')
    console.error('Usage: DATABASE_URL="your-connection-string" npx ts-node scripts/setup-production-db.ts')
    process.exit(1)
  }

  // Check if it's a Supabase URL
  const isSupabase = databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com')
  
  if (isSupabase) {
    console.log('🔍 Detected Supabase database')
    
    // Ensure SSL is enabled for Supabase
    if (!databaseUrl.includes('sslmode=')) {
      console.warn('⚠️  Warning: Supabase requires SSL. Make sure your connection string includes sslmode=require')
      console.warn('   Example: postgresql://user:pass@host:5432/db?sslmode=require')
    }
  }

  console.log('📊 Setting up production database schema...\n')

  try {
    // Test connection first
    console.log('1. Testing database connection...')
    await prisma.$connect()
    console.log('   ✅ Connected successfully\n')

    // Push schema
    console.log('2. Pushing Prisma schema to database...')
    // We'll use Prisma's programmatic API to push the schema
    const { execSync } = require('child_process')
    
    try {
      // Use prisma db push with the connection string and timeout
      // Create a timeout wrapper
      const timeout = 30000 // 30 seconds
      const startTime = Date.now()
      
      const pushProcess = execSync('npx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: databaseUrl },
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })
      
      const elapsed = Date.now() - startTime
      if (elapsed > timeout) {
        throw new Error(`Prisma db push timed out after ${timeout}ms`)
      }
      
      console.log(pushProcess)
      console.log('   ✅ Schema pushed successfully\n')
    } catch (error: any) {
      console.error('   ❌ Error pushing schema')
      if (error.message && error.message.includes('timeout')) {
        console.error('   ⏱️  Command timed out. This might be a network issue.')
        console.error('   💡 Try using Supabase SQL Editor instead (see SUPABASE-SETUP.md)')
      }
      if (error.stdout) console.error('   stdout:', error.stdout.toString())
      if (error.stderr) console.error('   stderr:', error.stderr.toString())
      throw error
    }

    // Verify tables were created
    console.log('3. Verifying tables...')
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    
    const expectedTables = [
      'users',
      'accounts',
      'sessions',
      'verification_tokens',
      'peaks',
      'peak_sources',
      'weather_snapshots',
      'land_status_snapshots',
      'road_status_snapshots',
      'manual_notes',
    ]

    console.log(`   Found ${tables.length} tables:`)
    tables.forEach((table) => {
      const check = expectedTables.includes(table.tablename) ? '✅' : '⚠️'
      console.log(`   ${check} ${table.tablename}`)
    })

    const missingTables = expectedTables.filter(
      (table) => !tables.some((t) => t.tablename === table)
    )

    if (missingTables.length > 0) {
      console.warn(`\n   ⚠️  Missing tables: ${missingTables.join(', ')}`)
    } else {
      console.log('\n   ✅ All expected tables are present')
    }

    console.log('\n✅ Database setup complete!')
    console.log('\nNext steps:')
    console.log('1. Create your first admin user by signing in at your app')
    console.log('2. Update the user role to ADMIN in the database')
    console.log('3. Or use the admin user management page if you have another admin')
  } catch (error) {
    console.error('\n❌ Error setting up database:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('SSL') || error.message.includes('ssl')) {
        console.error('\n💡 SSL Error Detected!')
        console.error('Supabase requires SSL. Update your DATABASE_URL to include: ?sslmode=require')
        console.error('Example: postgresql://user:pass@host:5432/db?sslmode=require')
      } else if (error.message.includes('connection') || error.message.includes('timeout')) {
        console.error('\n💡 Connection Error!')
        console.error('Check that:')
        console.error('1. Your DATABASE_URL is correct')
        console.error('2. Your Supabase database is running')
        console.error('3. Your IP is allowed in Supabase settings (if using IP restrictions)')
        console.error('4. The connection string includes SSL parameters for Supabase')
      }
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

