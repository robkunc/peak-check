import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx ts-node scripts/add-allowed-user.ts <email>')
    process.exit(1)
  }

  // Check if already exists
  const existing = await prisma.allowedUser.findUnique({
    where: { email }
  })

  if (existing) {
    console.log(`✅ ${email} is already in allowed_users table`)
  } else {
    const user = await prisma.allowedUser.create({
      data: { email }
    })
    console.log(`✅ Added ${email} to allowed_users table (id: ${user.id})`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
