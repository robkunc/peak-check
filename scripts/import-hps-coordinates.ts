/**
 * Script to import GPS coordinates from HPS coordinates table
 * 
 * The HPS website has a PDF with coordinates. This script can:
 * 1. Scrape individual peak pages for coordinates
 * 2. Parse a CSV/text file if you provide one
 * 3. Parse HTML if coordinates are in a table
 * 
 * Usage: 
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-hps-coordinates.ts
 *   (will scrape peak pages for coordinates)
 * 
 * Or provide a file:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-hps-coordinates.ts /path/to/coordinates.csv
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { scrapeUrl } from '../src/lib/firecrawl-client'

const prisma = new PrismaClient()

interface CoordinateData {
  peakName: string
  lat: number
  lng: number
}

/**
 * Parse coordinates from HTML or text
 */
function parseCoordinates(content: string): CoordinateData[] {
  const coordinates: CoordinateData[] = []
  
  // Try to find a table with coordinates
  // Look for patterns like: Peak Name | Lat | Long
  // Or: <td>Peak Name</td><td>34.2892</td><td>-117.6462</td>
  
  // Pattern 1: HTML table cells
  const htmlTableRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([\d\.\-]+)<\/td>[\s\S]*?<td[^>]*>([\d\.\-]+)<\/td>[\s\S]*?<\/tr>/gi
  let match
  while ((match = htmlTableRegex.exec(content)) !== null) {
    const name = match[1].trim()
    const lat = parseFloat(match[2])
    const lng = parseFloat(match[3])
    
    if (name && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      coordinates.push({ peakName: name, lat, lng })
    }
  }
  
  // Pattern 2: Markdown table
  const markdownTableRegex = /\|\s*([^|]+?)\s*\|\s*([\d\.\-]+)\s*\|\s*([\d\.\-]+)\s*\|/g
  while ((match = markdownTableRegex.exec(content)) !== null) {
    const name = match[1].trim()
    const lat = parseFloat(match[2])
    const lng = parseFloat(match[3])
    
    // Skip header rows
    if (name.match(/^(Peak|Name|Lat|Long|Latitude|Longitude)/i)) continue
    
    if (name && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      coordinates.push({ peakName: name, lat, lng })
    }
  }
  
  // Pattern 3: CSV-like format
  const csvRegex = /^([^,]+),([\d\.\-]+),([\d\.\-]+)/gm
  while ((match = csvRegex.exec(content)) !== null) {
    const name = match[1].trim()
    const lat = parseFloat(match[2])
    const lng = parseFloat(match[3])
    
    if (name && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      coordinates.push({ peakName: name, lat, lng })
    }
  }
  
  return coordinates
}

/**
 * Generate slug from peak name (same as in other scripts)
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Match peak name to database peak (fuzzy matching)
 */
async function findPeakByName(name: string): Promise<{ id: string; slug: string } | null> {
  // Try exact match first
  const slug = generateSlug(name)
  let peak = await prisma.peak.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  })
  
  if (peak) return peak
  
  // Try fuzzy match - remove common suffixes and try again
  const nameWithoutSuffix = name
    .replace(/\s*\(LO\)$/i, '')
    .replace(/\s*#\d+$/i, '')
    .replace(/\s*Mountain$/i, '')
    .replace(/\s*Peak$/i, '')
    .trim()
  
  if (nameWithoutSuffix !== name) {
    const fuzzySlug = generateSlug(nameWithoutSuffix)
    peak = await prisma.peak.findUnique({
      where: { slug: fuzzySlug },
      select: { id: true, slug: true },
    })
    
    if (peak) return peak
  }
  
  // Try searching by name contains
  const peaks = await prisma.peak.findMany({
    where: {
      name: {
        contains: name,
        mode: 'insensitive',
      },
    },
    select: { id: true, slug: true, name: true },
  })
  
  if (peaks.length === 1) {
    return { id: peaks[0].id, slug: peaks[0].slug }
  }
  
  // Try reverse - check if peak name contains our search name
  if (peaks.length === 0) {
    const allPeaks = await prisma.peak.findMany({
      where: {
        name: {
          contains: name.split(' ')[0], // Try first word
          mode: 'insensitive',
        },
      },
      select: { id: true, slug: true, name: true },
    })
    
    // Find best match
    for (const p of allPeaks) {
      if (p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase())) {
        return { id: p.id, slug: p.slug }
      }
    }
  }
  
  return null
}

/**
 * Main function
 */
async function main() {
  const input = process.argv[2]
  
  console.log('Starting HPS coordinates import...\n')
  
  try {
    let coordinates: CoordinateData[] = []
    
    if (!input) {
      // Scrape individual peak pages for coordinates
      console.log('No input provided. Scraping individual peak pages for coordinates...\n')
      console.log('This may take a while as we scrape each peak page...\n')
      
      const peaks = await prisma.peak.findMany({
        where: { isActive: true, gpsLat: null }, // Only get peaks without coordinates
        select: { id: true, name: true, slug: true },
      })
      
      console.log(`Found ${peaks.length} peaks without coordinates to check\n`)
      
      // Process in smaller batches to avoid overwhelming the API
      const BATCH_SIZE = 10
      const batches = []
      for (let i = 0; i < peaks.length; i += BATCH_SIZE) {
        batches.push(peaks.slice(i, i + BATCH_SIZE))
      }
      
      console.log(`Processing ${peaks.length} peaks in ${batches.length} batches of ${BATCH_SIZE}\n`)
      
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]
        console.log(`\n=== Batch ${batchIdx + 1}/${batches.length} ===\n`)
        
        for (let i = 0; i < batch.length; i++) {
          const peak = batch[i]
          const globalIdx = batchIdx * BATCH_SIZE + i + 1
          const url = `https://hundredpeaks.integritycleaningne.com/peaks/${peak.slug}/`
          
          try {
            console.log(`[${globalIdx}/${peaks.length}] Checking ${peak.name}...`)
            
            // Use scrapeUrl with built-in timeout (20 seconds)
            const { rawText } = await scrapeUrl(url, 20000)
            
            // Look for coordinates in the page
            // Pattern: 34.2892°N, 117.6462°W or 34.2892, -117.6462
            const coordRegex = /(\d+\.\d+)[°\s]*[NS]?[,\s]+([\d\.\-]+)[°\s]*[EW]?/g
            let match
            let found = false
            while ((match = coordRegex.exec(rawText)) !== null) {
              const lat = parseFloat(match[1])
              const lng = parseFloat(match[2])
              
              // Validate coordinates
              if (!isNaN(lat) && !isNaN(lng) && lat >= 30 && lat <= 40 && lng >= -125 && lng <= -110) {
                // Check if lng is positive (should be negative for California)
                const finalLng = lng > 0 ? -lng : lng
                
                coordinates.push({
                  peakName: peak.name,
                  lat,
                  lng: finalLng,
                })
                console.log(`  ✅ Found: ${lat}, ${finalLng}`)
                found = true
                break // Found coordinates for this peak
              }
            }
            
            if (!found) {
              console.log(`  ⚠️  No coordinates found in page`)
            }
            
            // Small delay to avoid rate limiting (2 seconds between requests)
            if (i < batch.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000))
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            if (errorMsg.includes('timeout')) {
              console.error(`  ⏱️  Timeout: ${errorMsg}`)
            } else {
              console.error(`  ❌ Error: ${errorMsg}`)
            }
            // Continue to next peak even if this one fails
          }
        }
        
        // Longer delay between batches (5 seconds)
        if (batchIdx < batches.length - 1) {
          console.log(`\nWaiting 5 seconds before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    } else if (input.startsWith('http://') || input.startsWith('https://')) {
      console.log(`Scraping from URL: ${input}`)
      const { rawText } = await scrapeUrl(input)
      coordinates = parseCoordinates(rawText)
    } else {
      console.log(`Reading from file: ${input}`)
      const content = readFileSync(input, 'utf-8')
      coordinates = parseCoordinates(content)
    }
    
    console.log(`\nFound ${coordinates.length} coordinate entries`)
    
    if (coordinates.length === 0) {
      console.log('\nNo coordinates found.')
      if (!input) {
        console.log('You can:')
        console.log('1. Provide a CSV file with columns: Peak Name, Latitude, Longitude')
        console.log('2. Or manually add coordinates via the admin interface')
      } else {
        console.log('The parsing logic may need adjustment for this format.')
      }
      process.exit(1)
    }
    
    // Show sample
    console.log('Sample coordinates found:')
    coordinates.slice(0, 5).forEach(c => {
      console.log(`  - ${c.peakName}: ${c.lat}, ${c.lng}`)
    })
    console.log('')
    
    // Import coordinates
    let updated = 0
    let notFound = 0
    const notFoundNames: string[] = []
    
    for (const coord of coordinates) {
      const peak = await findPeakByName(coord.peakName)
      
      if (peak) {
        await prisma.peak.update({
          where: { id: peak.id },
          data: {
            gpsLat: coord.lat,
            gpsLng: coord.lng,
          },
        })
        updated++
      } else {
        notFound++
        notFoundNames.push(coord.peakName)
      }
    }
    
    console.log('\n=== Import Summary ===')
    console.log(`Total coordinates found: ${coordinates.length}`)
    console.log(`✅ Updated: ${updated}`)
    console.log(`❌ Not found: ${notFound}`)
    
    if (notFoundNames.length > 0 && notFoundNames.length <= 20) {
      console.log('\nPeaks not found in database:')
      notFoundNames.slice(0, 20).forEach(n => console.log(`  - ${n}`))
    }
    
    console.log('\n✅ Import complete!')
    
  } catch (error) {
    console.error('\n❌ Error during import:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

