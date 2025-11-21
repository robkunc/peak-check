/**
 * Script to scrape peaks from Hundred Peaks Section website
 * and import them into the database
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/scrape-hps-peaks.ts
 */

import { PrismaClient } from '@prisma/client'
import { scrapeUrl } from '../src/lib/firecrawl-client'

const prisma = new PrismaClient()

interface HPSPeak {
  name: string
  elevation: number
  section: number
  sectionName: string
  letter: string
}

/**
 * Parse the HPS peaks list from scraped HTML/markdown
 */
function parseHPSPeaks(content: string): HPSPeak[] {
  const peaks: HPSPeak[] = []
  
  // Extract section information
  const sectionRegex = /## (\d+) - ([^(]+) \((\d+) peaks?\)/g
  const sections: Map<number, string> = new Map()
  
  let match
  while ((match = sectionRegex.exec(content)) !== null) {
    const sectionNum = parseInt(match[1])
    const sectionName = match[2].trim()
    sections.set(sectionNum, sectionName)
  }
  
  // Extract peak data - looking for patterns like:
  // | A | Peak Name | Elevation |
  const peakRegex = /\|\s*([A-Z])\s*\|\s*([^|]+)\s*\|\s*(\d+[\+\-]?)\s*\|/g
  
  let currentSection = 0
  let currentSectionName = ''
  
  const lines = content.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Check if this is a section header
    const sectionMatch = line.match(/## (\d+) - ([^(]+)/)
    if (sectionMatch) {
      currentSection = parseInt(sectionMatch[1])
      currentSectionName = sectionMatch[2].trim()
      continue
    }
    
    // Look for peak rows in table format
    const peakMatch = line.match(/\|\s*([A-Z])\s*\|\s*([^|]+)\s*\|\s*(\d+[\+\-]?)\s*\|/)
    if (peakMatch && currentSection > 0) {
      const letter = peakMatch[1]
      const name = peakMatch[2].trim()
      const elevationStr = peakMatch[3].replace(/[\+\-]/g, '')
      const elevation = parseInt(elevationStr)
      
      if (name && elevation && !isNaN(elevation)) {
        peaks.push({
          name,
          elevation,
          section: currentSection,
          sectionName: currentSectionName,
          letter,
        })
      }
    }
  }
  
  return peaks
}

/**
 * Generate slug from peak name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Main function
 */
async function main() {
  console.log('Starting HPS peaks import...')
  
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('ERROR: FIRECRAWL_API_KEY not set in environment')
    process.exit(1)
  }
  
  try {
    // Scrape the HPS peaks list page
    console.log('Scraping HPS peaks list page...')
    const { rawText } = await scrapeUrl('https://hundredpeaks.integritycleaningne.com/peaks-list/')
    
    console.log('Parsing peaks from scraped content...')
    const peaks = parseHPSPeaks(rawText)
    
    console.log(`Found ${peaks.length} peaks to import`)
    
    if (peaks.length === 0) {
      console.log('No peaks found. The parsing logic may need adjustment.')
      console.log('First 500 chars of scraped content:')
      console.log(rawText.substring(0, 500))
      process.exit(1)
    }
    
    // Import peaks into database
    let created = 0
    let updated = 0
    let skipped = 0
    
    for (const peakData of peaks) {
      const slug = generateSlug(peakData.name)
      
      try {
        // Check if peak already exists
        const existing = await prisma.peak.findUnique({
          where: { slug },
        })
        
        if (existing) {
          // Update existing peak
          await prisma.peak.update({
            where: { slug },
            data: {
              name: peakData.name,
              region: peakData.sectionName,
              isActive: true,
            },
          })
          updated++
          console.log(`Updated: ${peakData.name}`)
        } else {
          // Create new peak
          await prisma.peak.create({
            data: {
              name: peakData.name,
              slug,
              region: peakData.sectionName,
              isActive: true,
            },
          })
          created++
          console.log(`Created: ${peakData.name} (${peakData.elevation}ft)`)
        }
      } catch (error) {
        console.error(`Error processing ${peakData.name}:`, error)
        skipped++
      }
    }
    
    console.log('\n=== Import Summary ===')
    console.log(`Total peaks found: ${peaks.length}`)
    console.log(`Created: ${created}`)
    console.log(`Updated: ${updated}`)
    console.log(`Skipped/Errors: ${skipped}`)
    console.log('\nImport complete!')
    
  } catch (error) {
    console.error('Error during import:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

