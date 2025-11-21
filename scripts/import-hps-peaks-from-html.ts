/**
 * Script to import peaks from the saved HTML file
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-hps-peaks-from-html.ts /path/to/Peaks\ List\ –\ Hundred\ Peaks.html
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

interface HPSPeak {
  name: string
  elevation: number
  section: number
  sectionName: string
  letter: string
}

/**
 * Parse the HPS peaks list from HTML file
 */
function parseHPSPeaks(html: string): HPSPeak[] {
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
  
  console.log(`Found ${sections.length} sections`)
  
  // For each section, extract peaks
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const nextSectionStart = i < sections.length - 1 ? sections[i + 1].startIndex : html.length
    const sectionContent = html.substring(section.startIndex, nextSectionStart)
    
    // Extract all peak names from links in peak-name cells
    // Pattern: <div class="cell-table-compare"><a href="...">Peak Name</a></div>
    // or: <div class="cell-table-compare rating"><a href="...">Peak Name</a><img...></div>
    const nameRegex = /<div class="cell-table-compare[^"]*"[^>]*>\s*<a[^>]+href="[^"]*\/peaks\/[^"]*"[^>]*>([^<]+)<\/a>/gi
    const names: string[] = []
    let nameMatch
    
    while ((nameMatch = nameRegex.exec(sectionContent)) !== null) {
      const name = nameMatch[1].trim()
      if (name && name.length > 0) {
        names.push(name)
      }
    }
    
    // Extract all elevations (numbers in elevation cells, skip header)
    // Pattern: <div class="cell-table-compare">8295</div> or <div class="cell-table-compare">6760+</div>
    const elevationRegex = /<div class="cell-table-compare"[^>]*>(\d+[\+\-]?)<\/div>/g
    const elevations: number[] = []
    let elevMatch
    
    while ((elevMatch = elevationRegex.exec(sectionContent)) !== null) {
      const elevStr = elevMatch[1].replace(/[\+\-]/g, '')
      const elev = parseInt(elevStr)
      // Skip if it's the header "Elevation" or if it's not a valid elevation (too small or too large)
      if (!isNaN(elev) && elev > 1000 && elev < 15000) {
        elevations.push(elev)
      }
    }
    
    // Match names with elevations by position
    // They should be in the same order, but we'll match them carefully
    const minLength = Math.min(names.length, elevations.length)
    for (let j = 0; j < minLength; j++) {
      peaks.push({
        name: names[j],
        elevation: elevations[j],
        section: section.num,
        sectionName: section.name,
        letter: '', // We could extract this if needed
      })
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
  const htmlFilePath = process.argv[2] || '/Users/omar.patel/Downloads/Peaks List – Hundred Peaks.html'
  
  console.log('Starting HPS peaks import from HTML file...\n')
  console.log(`Reading file: ${htmlFilePath}\n`)
  
  try {
    // Read the HTML file
    const html = readFileSync(htmlFilePath, 'utf-8')
    
    console.log('Parsing peaks from HTML...')
    const peaks = parseHPSPeaks(html)
    
    console.log(`Found ${peaks.length} peaks to import\n`)
    
    if (peaks.length === 0) {
      console.log('No peaks found. The parsing logic may need adjustment.')
      process.exit(1)
    }
    
    // Show sample of what we found
    console.log('Sample peaks found:')
    peaks.slice(0, 10).forEach(p => {
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
    console.log('2. Run: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/add-common-sources.ts')
    console.log('3. Run refresh jobs to populate data')
    
  } catch (error) {
    console.error('\n❌ Error during import:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      if (error.message.includes('ENOENT')) {
        console.error('\nFile not found. Please provide the correct path to the HTML file.')
        console.error('Usage: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/import-hps-peaks-from-html.ts /path/to/file.html')
      }
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

