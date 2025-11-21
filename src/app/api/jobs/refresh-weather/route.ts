import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchWeatherForPeak } from '@/lib/noaa-api'

/**
 * POST /api/jobs/refresh-weather
 * 
 * Background job to refresh weather data for all peaks with GPS coordinates.
 * Should be called by a cron job (e.g., every 3 hours).
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

    // Get all active peaks with GPS coordinates
    const peaks = await prisma.peak.findMany({
      where: {
        isActive: true,
        gpsLat: { not: null },
        gpsLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        gpsLat: true,
        gpsLng: true,
      },
    })

    const results = {
      total: peaks.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ peakId: string; peakName: string; error: string }>,
    }

    // Process peaks sequentially to avoid rate limiting
    for (const peak of peaks) {
      if (!peak.gpsLat || !peak.gpsLng) continue

      try {
        const weatherData = await fetchWeatherForPeak(peak.gpsLat, peak.gpsLng, peak.name)

        // Store weather snapshot
        await prisma.weatherSnapshot.create({
          data: {
            peakId: peak.id,
            source: 'NOAA',
            rawJson: weatherData.rawJson as any, // Prisma Json type
            summaryText: weatherData.summaryText,
            fetchedAt: weatherData.fetchedAt,
          },
        })

        results.successful++
      } catch (error) {
        results.failed++
        results.errors.push({
          peakId: peak.id,
          peakName: peak.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        console.error(`Failed to fetch weather for ${peak.name}:`, error)
      }

      // Small delay to avoid rate limiting (NOAA API has rate limits)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in refresh-weather job:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

