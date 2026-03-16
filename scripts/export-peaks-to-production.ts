/**
 * Export peaks and their sources from local database and import to production
 * 
 * Usage:
 * 1. Set DATABASE_URL to your local database
 * 2. Set PRODUCTION_DATABASE_URL to your production Supabase database
 * 3. Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/export-peaks-to-production.ts
 */

import { PrismaClient } from '@prisma/client'

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL,
    },
  },
})

async function main() {
  if (!process.env.PRODUCTION_DATABASE_URL) {
    console.error('❌ PRODUCTION_DATABASE_URL environment variable is required')
    console.error('   Set it to your production Supabase connection string')
    process.exit(1)
  }

  console.log('📤 Exporting peaks from local database...')

  // Fetch all peaks with their sources
  const peaks = await localPrisma.peak.findMany({
    include: {
      sources: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  console.log(`Found ${peaks.length} peaks to export`)

  if (peaks.length === 0) {
    console.log('No peaks to export. Exiting.')
    return
  }

  console.log('\n📥 Importing peaks to production database...')

  let imported = 0
  let skipped = 0
  let errors = 0
  let sourcesImported = 0

  for (const peak of peaks) {
    try {
      // Check if peak already exists by slug
      let productionPeak = await productionPrisma.peak.findUnique({
        where: { slug: peak.slug },
      })

      if (!productionPeak) {
        // Create the peak
        productionPeak = await productionPrisma.peak.create({
          data: {
            name: peak.name,
            slug: peak.slug,
            region: peak.region,
            gpsLat: peak.gpsLat,
            gpsLng: peak.gpsLng,
            isActive: peak.isActive,
          },
        })
        console.log(`✓ Created peak: ${peak.name}`)
        imported++
      } else {
        console.log(`⏭️  Peak ${peak.name} already exists, checking sources...`)
        skipped++
      }

      // Import sources for this peak (even if peak already exists)
      if (peak.sources.length > 0) {
        // Get existing sources for this peak
        const existingSources = await productionPrisma.peakSource.findMany({
          where: { peakId: productionPeak.id },
        })
        const existingUrls = new Set(existingSources.map(s => s.url))

        let sourceCount = 0
        for (const source of peak.sources) {
          // Skip if source with this URL already exists
          if (existingUrls.has(source.url)) {
            continue
          }

          await productionPrisma.peakSource.create({
            data: {
              peakId: productionPeak.id,
              sourceType: source.sourceType,
              label: source.label,
              url: source.url,
            },
          })
          sourceCount++
          sourcesImported++
        }
        
        if (sourceCount > 0) {
          console.log(`  ✓ Imported ${sourceCount} new source(s) for ${peak.name}`)
        } else {
          console.log(`  ⏭️  All sources already exist for ${peak.name}`)
        }
      }

    } catch (error) {
      console.error(`❌ Error importing ${peak.name}:`, error)
      errors++
    }
  }

  console.log('\n✅ Import complete!')
  console.log(`   Peaks imported: ${imported}`)
  console.log(`   Peaks skipped: ${skipped}`)
  console.log(`   Sources imported: ${sourcesImported}`)
  console.log(`   Errors: ${errors}`)
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await localPrisma.$disconnect()
    await productionPrisma.$disconnect()
  })

