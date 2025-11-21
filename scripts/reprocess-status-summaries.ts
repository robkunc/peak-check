/**
 * Script to reprocess existing status summaries with the improved parser
 * 
 * This will update all existing land status and road status snapshots
 * with cleaned summaries using the new parser.
 * 
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reprocess-status-summaries.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@prisma/client'
import { generateDetailedSummary } from '../src/lib/status-parser'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting status summary reprocessing...\n')

  // Get all land status snapshots
  const landSnapshots = await prisma.landStatusSnapshot.findMany({
    where: {
      rawText: {
        not: null,
      },
    },
    select: {
      id: true,
      rawText: true,
      statusSummary: true,
    },
  })

  console.log(`Found ${landSnapshots.length} land status snapshots to reprocess`)

  let landUpdated = 0
  for (const snapshot of landSnapshots) {
    if (snapshot.rawText) {
      try {
        const newSummary = generateDetailedSummary(snapshot.rawText)
        if (newSummary !== snapshot.statusSummary) {
          await prisma.landStatusSnapshot.update({
            where: { id: snapshot.id },
            data: { statusSummary: newSummary },
          })
          landUpdated++
        }
      } catch (error) {
        console.error(`Error processing land snapshot ${snapshot.id}:`, error)
      }
    }
  }

  // Get all road status snapshots
  const roadSnapshots = await prisma.roadStatusSnapshot.findMany({
    where: {
      rawText: {
        not: null,
      },
    },
    select: {
      id: true,
      rawText: true,
      statusSummary: true,
    },
  })

  console.log(`Found ${roadSnapshots.length} road status snapshots to reprocess`)

  let roadUpdated = 0
  for (const snapshot of roadSnapshots) {
    if (snapshot.rawText) {
      try {
        const newSummary = generateDetailedSummary(snapshot.rawText)
        if (newSummary !== snapshot.statusSummary) {
          await prisma.roadStatusSnapshot.update({
            where: { id: snapshot.id },
            data: { statusSummary: newSummary },
          })
          roadUpdated++
        }
      } catch (error) {
        console.error(`Error processing road snapshot ${snapshot.id}:`, error)
      }
    }
  }

  console.log('\n=== Reprocessing Summary ===')
  console.log(`Land status snapshots updated: ${landUpdated}/${landSnapshots.length}`)
  console.log(`Road status snapshots updated: ${roadUpdated}/${roadSnapshots.length}`)
  console.log('\n✅ Reprocessing complete!')

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Error during reprocessing:', error)
  prisma.$disconnect()
  process.exit(1)
})

