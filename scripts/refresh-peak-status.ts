/**
 * Script to manually refresh status for a specific peak
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/refresh-peak-status.ts <peak-slug>
 */

import { PrismaClient } from '@prisma/client'
import { ensureFreshStatus } from '../src/lib/fetch-status-on-demand'
import 'dotenv/config'

const prisma = new PrismaClient()

async function main() {
  const peakSlug = process.argv[2]
  
  if (!peakSlug) {
    console.error('Usage: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/refresh-peak-status.ts <peak-slug>')
    process.exit(1)
  }
  
  console.log(`Refreshing status for peak: ${peakSlug}\n`)
  
  try {
    const peak = await prisma.peak.findUnique({
      where: { slug: peakSlug },
      include: {
        sources: true,
      },
    })
    
    if (!peak) {
      console.error(`Peak not found: ${peakSlug}`)
      process.exit(1)
    }
    
    console.log(`Found peak: ${peak.name}`)
    console.log(`Sources: ${peak.sources.length}`)
    console.log(`\nTriggering refresh...\n`)
    
    // Force refresh by setting env var
    process.env.FORCE_STATUS_REFRESH = 'true'
    
    await ensureFreshStatus(peak.id)
    
    console.log('✅ Refresh triggered successfully!')
    console.log('\nNote: The refresh runs in the background. Check the peak page in a few moments to see updated data.')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

