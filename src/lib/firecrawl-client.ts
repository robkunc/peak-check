/**
 * Firecrawl API Client
 * 
 * Uses Firecrawl to scrape and extract content from land manager and road status pages.
 */

import { FirecrawlAppV1 as FirecrawlApp } from '@mendable/firecrawl-js'

const firecrawlApiKey = process.env.FIRECRAWL_API_KEY

if (!firecrawlApiKey) {
  console.warn('FIRECRAWL_API_KEY not set. Firecrawl scraping will be disabled.')
}

// Initialize Firecrawl client
let firecrawl: any = null
if (firecrawlApiKey) {
  try {
    firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey })
  } catch (error) {
    console.error('Failed to initialize Firecrawl:', error)
  }
}

/**
 * Scrape a URL and extract the main content
 * @param url The URL to scrape
 * @param timeoutMs Timeout in milliseconds (default: 30000 = 30 seconds)
 */
export async function scrapeUrl(url: string, timeoutMs: number = 30000): Promise<{ rawText: string; markdown?: string }> {
  if (!firecrawl) {
    throw new Error('Firecrawl API key not configured')
  }

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Firecrawl request timeout after ${timeoutMs}ms`)), timeoutMs)
    })

    // Create the scrape promise
    const scrapePromise = firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
    })

    // Race between scrape and timeout
    const result = await Promise.race([scrapePromise, timeoutPromise])

        // Check if the result indicates an error (404, etc.)
        if (result.statusCode === 404 || result.statusCode === 410) {
          throw new Error(`Source URL returned ${result.statusCode}: ${url}`)
        }

        // Extract text from the result
        const markdown = result.markdown || ''
        const html = result.html || ''
        const rawText = markdown || html || result.content || ''

        // Check if the content indicates a 404 page
        const lowerText = rawText.toLowerCase()
        if ((lowerText.includes('404') || lowerText.includes('page not found') || lowerText.includes('not found')) && rawText.length < 500) {
          throw new Error(`Source URL appears to be a 404 page: ${url}`)
        }

        return {
          rawText,
          markdown: markdown || undefined,
        }
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      throw error
    }
    console.error(`Firecrawl error for ${url}:`, error)
    throw error
  }
}

/**
 * Check if Firecrawl is configured
 */
export function isFirecrawlConfigured(): boolean {
  return firecrawl !== null
}

