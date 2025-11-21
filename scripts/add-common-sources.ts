/**
 * Script to add common land manager and road status sources to peaks
 * 
 * This adds common sources like Angeles National Forest, Caltrans, etc.
 * You can customize the sources list below.
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/add-common-sources.ts
 */

import { PrismaClient, SourceType } from '@prisma/client'

const prisma = new PrismaClient()

interface CommonSource {
  label: string
  url: string
  sourceType: SourceType
  regionMatch?: string[] // If provided, only add to peaks in these regions
}

// Common sources to add
const commonSources: CommonSource[] = [
  // Land Manager Sources
  {
    label: 'Angeles National Forest',
    url: 'https://www.fs.usda.gov/alerts/angeles/alerts-notices',
    sourceType: 'LAND_MANAGER',
    regionMatch: [
      'Western Angeles Crest', 'Mount Wilson Area', 'North of Angeles Crest Hwy 2', 
      'South of Angeles Crest Hwy 2', 'San Gabriel River Basin', 'Mount San Antonio Area', 
      'Cucamonga Peak Area', 'San Gabriel Mountains', 'West of Mill Creek', 'Liebre Range'
    ],
  },
  {
    label: 'San Bernardino National Forest',
    url: 'https://www.fs.usda.gov/r5/sanbernardino/alerts',
    sourceType: 'LAND_MANAGER',
    regionMatch: [
      'Lake Arrowhead', 'Big Pine Flat Area', 'North of Big Bear Lake', 
      'South of Big Bear Lake', 'East of Big Bear Lake', 'San Gorgonio Area', 
      'Yucaipa Ridge Area', 'San Bernardino Mountains', 'San Jacinto Area', 
      'San Jacinto Mountains', 'Little San Bernardino Mountains', 'Desert Divide',
      'South of Hwy 74', 'Santa Rosa Mountains'
    ],
  },
  {
    label: 'Cleveland National Forest',
    url: 'https://www.fs.usda.gov/alerts/cleveland/alerts-notices',
    sourceType: 'LAND_MANAGER',
    regionMatch: [
      'Orange County', 'San Diego County North of Hwy 78', 'San Diego County South of Hwy 78'
    ],
  },
  {
    label: 'Los Padres National Forest',
    url: 'https://www.fs.usda.gov/r5/lospadres/alerts',
    sourceType: 'LAND_MANAGER',
    regionMatch: [
      'Santa Barbara County', 'Ventura County', 'Southern Kern County West of Hwy 5'
    ],
  },
  {
    label: 'Inyo National Forest',
    url: 'https://www.fs.usda.gov/alerts/inyo/alerts-notices',
    sourceType: 'LAND_MANAGER',
    regionMatch: [
      'Southern Sierra North of Hwy 178', 'Southern Sierra South of Hwy 178'
    ],
  },
  
  // Road Status Sources
  // Use Caltrans API (via QuickMap/Alpha.CA.gov) for all California peaks
  // The system will automatically use the API when GPS coordinates are available
  {
    label: 'Caltrans Road Status (API)',
    url: 'https://quickmap.dot.ca.gov/',
    sourceType: 'ROAD_STATUS',
    // Apply to ALL peaks (no regionMatch means it applies to all)
    // This ensures every peak gets road status data
  },
  // Also add Forest Service pages as backup sources
  {
    label: 'Angeles NF Road Conditions',
    url: 'https://www.fs.usda.gov/detail/angeles/notices/?cid=stelprdb5309858',
    sourceType: 'ROAD_STATUS',
    regionMatch: ['Western Angeles Crest', 'Mount Wilson Area', 'North of Angeles Crest Hwy 2', 'South of Angeles Crest Hwy 2', 'San Gabriel River Basin', 'Mount San Antonio Area', 'Cucamonga Peak Area'],
  },
  {
    label: 'San Bernardino NF Road Conditions',
    url: 'https://www.fs.usda.gov/detail/sanbernardino/notices/?cid=stelprdb5309858',
    sourceType: 'ROAD_STATUS',
    regionMatch: ['Lake Arrowhead', 'Big Pine Flat Area', 'North of Big Bear Lake', 'South of Big Bear Lake', 'East of Big Bear Lake', 'San Gorgonio Area', 'Yucaipa Ridge Area'],
  },
  {
    label: 'Los Padres NF Road Conditions',
    url: 'https://www.fs.usda.gov/r05/lospadres/conditions',
    sourceType: 'ROAD_STATUS',
    regionMatch: ['Santa Barbara County', 'Ventura County'],
  },
  {
    label: 'Cleveland NF Road Conditions',
    url: 'https://www.fs.usda.gov/detail/cleveland/notices/?cid=stelprdb5309858',
    sourceType: 'ROAD_STATUS',
    regionMatch: ['Orange County', 'San Diego County North of Hwy 78', 'San Diego County South of Hwy 78'],
  },
  {
    label: 'Inyo NF Road Conditions',
    url: 'https://www.fs.usda.gov/detail/inyo/notices/?cid=stelprdb5309858',
    sourceType: 'ROAD_STATUS',
    regionMatch: ['Southern Sierra North of Hwy 178', 'Southern Sierra South of Hwy 178'],
  },
]

async function main() {
  console.log('Adding common sources to peaks...\n')
  
  try {
    // Get all active peaks
    const peaks = await prisma.peak.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        region: true,
        sources: {
          select: {
            url: true,
            sourceType: true,
          },
        },
      },
    })
    
    console.log(`Found ${peaks.length} active peaks\n`)
    
    let totalAdded = 0
    let totalSkipped = 0
    
    for (const source of commonSources) {
      console.log(`Processing: ${source.label} (${source.sourceType})`)
      
      let added = 0
      let skipped = 0
      
      for (const peak of peaks) {
        // Check if source should be added to this peak based on region
        // If no regionMatch is specified, add to all peaks
        if (source.regionMatch && source.regionMatch.length > 0) {
          if (!peak.region) {
            skipped++
            continue
          }
          const matches = source.regionMatch.some(region => 
            peak.region?.toLowerCase().includes(region.toLowerCase()) ||
            region.toLowerCase().includes(peak.region?.toLowerCase() || '')
          )
          if (!matches) {
            skipped++
            continue
          }
        }
        // If no regionMatch specified, add to all peaks
        
        // Check if this source already exists for this peak
        const existing = peak.sources.find(
          s => s.url === source.url && s.sourceType === source.sourceType
        )
        
        if (existing) {
          skipped++
          continue
        }
        
        // Add the source
        try {
          await prisma.peakSource.create({
            data: {
              peakId: peak.id,
              sourceType: source.sourceType,
              label: source.label,
              url: source.url,
            },
          })
          added++
        } catch (error) {
          console.error(`  Error adding source to ${peak.name}:`, error)
          skipped++
        }
      }
      
      console.log(`  ✅ Added to ${added} peaks, skipped ${skipped} (already exists or no match)`)
      totalAdded += added
      totalSkipped += skipped
    }
    
    console.log('\n=== Summary ===')
    console.log(`✅ Total sources added: ${totalAdded}`)
    console.log(`⏭️  Total skipped: ${totalSkipped}`)
    console.log('\n✅ Done!')
    console.log('\nNext steps:')
    console.log('1. Run refresh jobs to populate data:')
    console.log('   - POST /api/jobs/refresh-land-status')
    console.log('   - POST /api/jobs/refresh-road-status')
    console.log('2. Or trigger manually from admin interface')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

