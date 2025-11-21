import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeUrl, isFirecrawlConfigured } from '@/lib/firecrawl-client'
import { inferStatusFromText, generateDetailedSummary } from '@/lib/status-parser'
import { fetchRoadStatusForPeak } from '@/lib/caltrans-api'

/**
 * POST /api/jobs/refresh-road-status
 * 
 * Background job to refresh road status for all peaks with ROAD_STATUS sources.
 * Should be called by a cron job (e.g., daily or every 6 hours).
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

    // Get all active peaks with ROAD_STATUS sources
    const peaks = await prisma.peak.findMany({
      where: {
        isActive: true,
        sources: {
          some: {
            sourceType: 'ROAD_STATUS',
          },
        },
      },
      include: {
        sources: {
          where: {
            sourceType: 'ROAD_STATUS',
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
      // Get peak coordinates if available
      const peakWithCoords = await prisma.peak.findUnique({
        where: { id: peak.id },
        select: { gpsLat: true, gpsLng: true, name: true },
      })
      
      for (const source of peak.sources) {
        try {
          // Check if this is a Caltrans source and we have coordinates
          const isCaltransSource = source.url.includes('caltrans') || 
                                   source.url.includes('dot.ca.gov') || 
                                   source.url.includes('quickmap') ||
                                   source.url.includes('alpha.ca.gov')
          
          if (isCaltransSource && peakWithCoords?.gpsLat && peakWithCoords?.gpsLng) {
            // Try Caltrans API first
            try {
              const roadStatus = await fetchRoadStatusForPeak(
                peakWithCoords.gpsLat,
                peakWithCoords.gpsLng,
                peakWithCoords.name
              )
              
              await prisma.roadStatusSnapshot.create({
                data: {
                  peakId: peak.id,
                  peakSourceId: source.id,
                  rawText: roadStatus.rawText.substring(0, 10000),
                  statusSummary: roadStatus.statusSummary,
                  statusCode: roadStatus.statusCode,
                  fetchedAt: new Date(),
                },
              })
              
              results.successful++
              // Small delay to avoid rate limiting
              await new Promise((resolve) => setTimeout(resolve, 500))
              continue
            } catch (apiError) {
              console.error(`Caltrans API error for ${peak.name}, falling back to scraping:`, apiError)
              // Fall through to scraping
            }
          }
          
          // Fallback: Scrape the URL (for non-Caltrans sources or if API fails)
          if (!isFirecrawlConfigured()) {
            throw new Error('Firecrawl API key not configured')
          }
          
          const { rawText } = await scrapeUrl(source.url)

          // Parse status from text
          const parsedStatus = inferStatusFromText(rawText)
          const detailedSummary = generateDetailedSummary(rawText)

          // Store snapshot
          await prisma.roadStatusSnapshot.create({
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
            `Failed to fetch road status for ${peak.name} (${source.label}):`,
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
    console.error('Error in refresh-road-status job:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

