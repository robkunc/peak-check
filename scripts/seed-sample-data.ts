/**
 * Sample data seeding script for development
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-sample-data.ts
 */

import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding sample data...')

  // Create sample peaks
  const peaks = [
    {
      name: 'Mount Baldy (Mount San Antonio)',
      slug: 'mount-baldy',
      region: 'San Gabriel Mountains',
      gpsLat: 34.2892,
      gpsLng: -117.6462,
    },
    {
      name: 'Mount San Gorgonio',
      slug: 'mount-san-gorgonio',
      region: 'San Bernardino Mountains',
      gpsLat: 34.0992,
      gpsLng: -116.8249,
    },
    {
      name: 'San Jacinto Peak',
      slug: 'san-jacinto-peak',
      region: 'San Jacinto Mountains',
      gpsLat: 33.8144,
      gpsLng: -116.6791,
    },
    {
      name: 'Mount Wilson',
      slug: 'mount-wilson',
      region: 'San Gabriel Mountains',
      gpsLat: 34.2236,
      gpsLng: -118.0583,
    },
    {
      name: 'Cucamonga Peak',
      slug: 'cucamonga-peak',
      region: 'San Gabriel Mountains',
      gpsLat: 34.2131,
      gpsLng: -117.5996,
    },
    {
      name: 'San Bernardino Peak',
      slug: 'san-bernardino-peak',
      region: 'San Bernardino Mountains',
      gpsLat: 34.1697,
      gpsLng: -116.9142,
    },
  ]

  for (const peak of peaks) {
    const created = await prisma.peak.upsert({
      where: { slug: peak.slug },
      update: {},
      create: peak,
    })
    console.log(`✓ Created peak: ${created.name}`)

    // Add sample sources for some peaks
    if (peak.slug === 'mount-baldy') {
      await prisma.peakSource.create({
        data: {
          peakId: created.id,
          sourceType: 'LAND_MANAGER',
          label: 'Angeles National Forest',
          url: 'https://www.fs.usda.gov/angeles',
        },
      })
      console.log(`  ✓ Added source for ${created.name}`)
    }
  }

  console.log('✅ Sample data seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding data:', e)
    await prisma.$disconnect()
    process.exit(1)
  })


