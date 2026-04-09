import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx ts-node scripts/set-admin.ts <email>')
    process.exit(1)
  }

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    console.error(`❌ User with email ${email} not found. They need to sign in at least once first.`)
    process.exit(1)
  }

  // Update to ADMIN role
  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' }
  })

  console.log(`✅ ${email} is now an ADMIN`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
