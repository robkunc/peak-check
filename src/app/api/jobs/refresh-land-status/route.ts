import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeUrl, isFirecrawlConfigured } from '@/lib/firecrawl-client'
import { inferStatusFromText, generateDetailedSummary } from '@/lib/status-parser'

/**
 * POST /api/jobs/refresh-land-status
 * 
 * Background job to refresh land manager status for all peaks with LAND_MANAGER sources.
 * Should be called by a cron job (e.g., daily).
 * 
 * Protected by CRON_SECRET environment variable.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isFirecrawlConfigured()) {
      return NextResponse.json(
        { error: 'Firecrawl API key not configured' },
        { status: 500 }
      )
    }

    // Get all active peaks with LAND_MANAGER sources
    const peaks = await prisma.peak.findMany({
      where: {
        isActive: true,
        sources: {
          some: {
            sourceType: 'LAND_MANAGER',
          },
        },
      },
      include: {
        sources: {
          where: {
            sourceType: 'LAND_MANAGER',
          },
        },
      },
    })

    const results = {
      total: peaks.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ peakId: string; peakName: string; sourceId: string; error: string }>,
    }

    // Process peaks sequentially to avoid rate limiting
    for (const peak of peaks) {
      for (const source of peak.sources) {
        try {
          // Scrape the URL
          const { rawText } = await scrapeUrl(source.url)

          // Parse status from text
          const parsedStatus = inferStatusFromText(rawText)
          const detailedSummary = generateDetailedSummary(rawText)

          // Store snapshot
          await prisma.landStatusSnapshot.create({
            data: {
              peakId: peak.id,
              peakSourceId: source.id,
              rawText: rawText.substring(0, 10000), // Limit to 10k chars
              statusSummary: detailedSummary,
              statusCode: parsedStatus.statusCode,
              fetchedAt: new Date(),
            },
          })

          results.successful++
        } catch (error) {
          results.failed++
          results.errors.push({
            peakId: peak.id,
            peakName: peak.name,
            sourceId: source.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          console.error(
            `Failed to fetch land status for ${peak.name} (${source.label}):`,
            error
          )
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in refresh-land-status job:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

