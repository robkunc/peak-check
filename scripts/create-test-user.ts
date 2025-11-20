/**
 * Script to create a test user for development
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/create-test-user.ts
 */

import { PrismaClient, Role } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'test@example.com'
  const role = (process.argv[3] as Role) || Role.LEADER

  console.log(`Creating user: ${email} with role: ${role}`)

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    console.log(`User ${email} already exists. Updating role to ${role}...`)
    const updated = await prisma.user.update({
      where: { email },
      data: { role },
    })
    console.log(`✅ User updated: ${updated.email} (${updated.role})`)
    return
  }

  // Create new user
  const user = await prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      role,
      emailVerified: new Date(), // Mark as verified for testing
    },
  })

  console.log(`✅ User created: ${user.email} (${user.role})`)
  console.log(`\nYou can now sign in with this email.`)
  console.log(`Note: Since email isn't configured, you'll need to use Prisma Studio`)
  console.log(`to verify the user or use a different auth method.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })

