/**
 * Script to import peaks from Hundred Peaks Section website
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-hps-peaks.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

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
 * Parse the HPS peaks list from scraped content
 * Handles both HTML and markdown formats
 */
function parseHPSPeaks(content: string): HPSPeak[] {
  const peaks: HPSPeak[] = []
  
  // Try to parse as HTML first (if Firecrawl returns HTML)
  if (content.includes('<div class="cell-table-compare">')) {
    return parseHTMLFormat(content)
  }
  
  // Otherwise parse as markdown/text
  return parseMarkdownFormat(content)
}

/**
 * Parse HTML format from Firecrawl
 */
function parseHTMLFormat(html: string): HPSPeak[] {
  const peaks: HPSPeak[] = []
  
  // Extract section headers: <h2>1 - SECTION NAME (N peaks)</h2>
  const sectionRegex = /<h2[^>]*>(\d+)\s*-\s*([^(]+)\s*\((\d+)\s+peaks?\)<\/h2>/gi
  const sections: Array<{ num: number; name: string; startIndex: number }> = []
  
  let match
  while ((match = sectionRegex.exec(html)) !== null) {
    sections.push({
      num: parseInt(match[1]),
      name: match[2].trim(),
      startIndex: match.index,
    })
  }
  
  // Sort sections by position in document
  sections.sort((a, b) => a.startIndex - b.startIndex)
  
  // For each section, extract peaks
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const nextSectionStart = i < sections.length - 1 ? sections[i + 1].startIndex : html.length
    const sectionContent = html.substring(section.startIndex, nextSectionStart)
    
    // Extract peak names from links: <a href="...">Peak Name</a>
    const nameRegex = /<div[^>]*class="cell-table-compare"[^>]*>(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?(?:<img[^>]*>)?<\/div>/gi
    const names: string[] = []
    let nameMatch
    while ((nameMatch = nameRegex.exec(sectionContent)) !== null) {
      const name = nameMatch[1].trim()
      // Skip if it's a header or empty
      if (name && !name.match(/^(Peak Name|Elevation|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)$/i)) {
        names.push(name)
      }
    }
    
    // Extract elevations: <div class="cell-table-compare">8295</div>
    const elevationRegex = /<div[^>]*class="cell-table-compare"[^>]*>(\d+[\+\-]?)<\/div>/gi
    const elevations: number[] = []
    let elevMatch
    while ((elevMatch = elevationRegex.exec(sectionContent)) !== null) {
      const elevStr = elevMatch[1].replace(/[\+\-]/g, '')
      const elev = parseInt(elevStr)
      if (!isNaN(elev) && elev > 0) {
        elevations.push(elev)
      }
    }
    
    // Match names with elevations (they should be in the same order)
    const minLength = Math.min(names.length, elevations.length)
    for (let j = 0; j < minLength; j++) {
      peaks.push({
        name: names[j],
        elevation: elevations[j],
        section: section.num,
        sectionName: section.name,
        letter: '', // We could extract this too if needed
      })
    }
  }
  
  return peaks
}

/**
 * Parse markdown/text format
 */
function parseMarkdownFormat(content: string): HPSPeak[] {
  const peaks: HPSPeak[] = []
  
  // Extract section information
  const sectionRegex = /##\s*(\d+)\s*-\s*([^(]+)\s*\((\d+)\s+peaks?\)/gi
  const sections: Array<{ num: number; name: string; startIndex: number }> = []
  
  let match
  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push({
      num: parseInt(match[1]),
      name: match[2].trim(),
      startIndex: match.index,
    })
  }
  
  // Sort sections by position
  sections.sort((a, b) => a.startIndex - b.startIndex)
  
  // For each section, try to extract peaks from markdown tables
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const nextSectionStart = i < sections.length - 1 ? sections[i + 1].startIndex : content.length
    const sectionContent = content.substring(section.startIndex, nextSectionStart)
    
    // Look for markdown table rows: | Letter | Peak Name | Elevation |
    const tableRowRegex = /\|\s*([A-Z]?)\s*\|\s*([^|]+?)\s*\|\s*(\d+[\+\-]?)\s*\|/g
    let rowMatch
    while ((rowMatch = tableRowRegex.exec(sectionContent)) !== null) {
      const letter = rowMatch[1] || ''
      const name = rowMatch[2].trim().replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
      const elevationStr = rowMatch[3].replace(/[\+\-]/g, '')
      const elevation = parseInt(elevationStr)
      
      if (name && name.length > 0 && !name.match(/^(Peak Name|Elevation)$/i) && elevation && !isNaN(elevation) && elevation > 0) {
        peaks.push({
          name,
          elevation,
          section: section.num,
          sectionName: section.name,
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
  console.log('Starting HPS peaks import...\n')
  
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('ERROR: FIRECRAWL_API_KEY not set in environment')
    console.error('Please set it in your .env.local file')
    process.exit(1)
  }
  
  try {
    // Scrape the HPS peaks list page
    console.log('Scraping HPS peaks list page...')
    const { rawText } = await scrapeUrl('https://hundredpeaks.integritycleaningne.com/peaks-list/')
    
    console.log('Parsing peaks from scraped content...')
    const peaks = parseHPSPeaks(rawText)
    
    console.log(`Found ${peaks.length} peaks to import\n`)
    
    if (peaks.length === 0) {
      console.log('No peaks found. The parsing logic may need adjustment.')
      console.log('\nFirst 1000 chars of scraped content:')
      console.log(rawText.substring(0, 1000))
      process.exit(1)
    }
    
    // Show sample of what we found
    console.log('Sample peaks found:')
    peaks.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name} (${p.elevation}ft) - Section ${p.section}: ${p.sectionName}`)
    })
    console.log('')
    
    // Import peaks into database
    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []
    
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
        }
      } catch (error) {
        const errorMsg = `Error processing ${peakData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
        skipped++
      }
    }
    
    console.log('\n=== Import Summary ===')
    console.log(`Total peaks found: ${peaks.length}`)
    console.log(`✅ Created: ${created}`)
    console.log(`🔄 Updated: ${updated}`)
    console.log(`❌ Skipped/Errors: ${skipped}`)
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\nErrors:')
      errors.forEach(e => console.log(`  - ${e}`))
    }
    
    console.log('\n✅ Import complete!')
    console.log('\nNext steps:')
    console.log('1. Add GPS coordinates to peaks (can be done via admin interface)')
    console.log('2. Add land manager and road status sources to peaks')
    console.log('3. Run refresh jobs to populate data')
    
  } catch (error) {
    console.error('\n❌ Error during import:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

