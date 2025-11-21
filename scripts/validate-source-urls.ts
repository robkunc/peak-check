/**
 * Script to validate all peak source URLs
 * 
 * Checks each URL to see if it returns a valid response (200) or if it's broken (404, etc.)
 * 
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/validate-source-urls.ts
 */

import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient()

interface ValidationResult {
  peakName: string
  sourceLabel: string
  url: string
  sourceType: string
  statusCode: number | null
  isValid: boolean
  error?: string
}

async function checkUrl(url: string): Promise<{ statusCode: number | null; error?: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full content
      signal: controller.signal,
      redirect: 'follow',
    })
    
    clearTimeout(timeoutId)
    return { statusCode: response.status }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { statusCode: null, error: 'Timeout' }
    }
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return { statusCode: null, error: 'Connection failed' }
    }
    // Try GET if HEAD fails (some servers don't support HEAD)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      })
      
      clearTimeout(timeoutId)
      return { statusCode: response.status }
    } catch (retryError: any) {
      return { statusCode: null, error: retryError.message || 'Unknown error' }
    }
  }
}

async function main() {
  console.log('Validating all peak source URLs...\n')
  
  try {
    // Get all active peaks with their sources
    const peaks = await prisma.peak.findMany({
      where: { isActive: true },
      include: {
        sources: {
          orderBy: { label: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    
    console.log(`Found ${peaks.length} active peaks with sources\n`)
    
    const results: ValidationResult[] = []
    const uniqueUrls = new Set<string>()
    
    // Collect all unique URLs first
    for (const peak of peaks) {
      for (const source of peak.sources) {
        uniqueUrls.add(source.url)
      }
    }
    
    console.log(`Checking ${uniqueUrls.size} unique URLs...\n`)
    
    // Check each unique URL once
    const urlStatusMap = new Map<string, { statusCode: number | null; error?: string }>()
    
    let checked = 0
    for (const url of uniqueUrls) {
      checked++
      process.stdout.write(`\rChecking ${checked}/${uniqueUrls.size}: ${url.substring(0, 60)}...`)
      
      const result = await checkUrl(url)
      urlStatusMap.set(url, result)
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('\n\nValidating results...\n')
    
    // Now map results to each peak/source
    for (const peak of peaks) {
      for (const source of peak.sources) {
        const urlResult = urlStatusMap.get(source.url) || { statusCode: null, error: 'Not checked' }
        const isValid = urlResult.statusCode !== null && urlResult.statusCode >= 200 && urlResult.statusCode < 400
        
        results.push({
          peakName: peak.name,
          sourceLabel: source.label,
          url: source.url,
          sourceType: source.sourceType,
          statusCode: urlResult.statusCode,
          isValid,
          error: urlResult.error,
        })
      }
    }
    
    // Group results by validity
    const valid = results.filter(r => r.isValid)
    const invalid = results.filter(r => !r.isValid)
    
    console.log('=== Validation Results ===\n')
    console.log(`✅ Valid URLs: ${valid.length}`)
    console.log(`❌ Invalid URLs: ${invalid.length}\n`)
    
    if (invalid.length > 0) {
      console.log('=== INVALID URLs ===\n')
      
      // Group by URL to show which peaks are affected
      const invalidByUrl = new Map<string, ValidationResult[]>()
      for (const result of invalid) {
        if (!invalidByUrl.has(result.url)) {
          invalidByUrl.set(result.url, [])
        }
        invalidByUrl.get(result.url)!.push(result)
      }
      
      for (const [url, affectedSources] of invalidByUrl.entries()) {
        console.log(`\n❌ ${url}`)
        console.log(`   Status: ${affectedSources[0].statusCode || 'N/A'} ${affectedSources[0].error || ''}`)
        console.log(`   Affected peaks:`)
        for (const source of affectedSources) {
          console.log(`     - ${source.peakName}: ${source.sourceLabel} (${source.sourceType})`)
        }
      }
    }
    
    // Show valid URLs grouped by type
    console.log('\n\n=== Valid URLs by Type ===\n')
    const validByType = new Map<string, ValidationResult[]>()
    for (const result of valid) {
      if (!validByType.has(result.sourceType)) {
        validByType.set(result.sourceType, [])
      }
      validByType.get(result.sourceType)!.push(result)
    }
    
    for (const [type, sources] of validByType.entries()) {
      console.log(`\n${type}: ${sources.length} valid sources`)
      const uniqueUrlsForType = new Set(sources.map(s => s.url))
      console.log(`  Unique URLs: ${uniqueUrlsForType.size}`)
      for (const url of Array.from(uniqueUrlsForType).slice(0, 5)) {
        console.log(`    - ${url}`)
      }
      if (uniqueUrlsForType.size > 5) {
        console.log(`    ... and ${uniqueUrlsForType.size - 5} more`)
      }
    }
    
    // Summary
    console.log('\n\n=== Summary ===')
    console.log(`Total peaks checked: ${peaks.length}`)
    console.log(`Total sources checked: ${results.length}`)
    console.log(`Unique URLs checked: ${uniqueUrls.size}`)
    console.log(`✅ Valid: ${valid.length}`)
    console.log(`❌ Invalid: ${invalid.length}`)
    
    if (invalid.length > 0) {
      console.log('\n⚠️  Action required: Please update the invalid URLs in the admin interface.')
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

