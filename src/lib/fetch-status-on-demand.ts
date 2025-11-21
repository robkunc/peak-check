/**
 * On-demand status fetching
 * 
 * Fetches road status and land status on-demand if data is stale or missing
 */

import { prisma } from './prisma'
import { scrapeUrl } from './firecrawl-client'
import { inferStatusFromText, generateDetailedSummary } from './status-parser'
import { fetchWeatherForPeak } from './noaa-api'
import { fetchRoadStatusForPeak } from './caltrans-api'

const STALE_THRESHOLD_HOURS = 6 // Consider data stale after 6 hours
const WEATHER_STALE_THRESHOLD_HOURS = 3 // Weather data is stale after 3 hours
const FORCE_REFRESH = process.env.FORCE_STATUS_REFRESH === 'true' // Allow forcing refresh via env var

/**
 * Check if snapshot is stale
 */
function isStale(fetchedAt: Date | null): boolean {
  if (!fetchedAt) return true
  const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60)
  return ageHours > STALE_THRESHOLD_HOURS
}

/**
 * Fetch and store status for a single source
 */
export async function fetchStatusForSource(
  peakId: string,
  sourceId: string,
  sourceType: string,
  url: string
): Promise<void> {
  try {
    // For road status, check if we should use Caltrans API
    if (sourceType === 'ROAD_STATUS' || sourceType === 'Road Status') {
      // Check if this is a Caltrans/QuickMap source
      const isCaltransSource = url.includes('caltrans') || 
                               url.includes('dot.ca.gov') || 
                               url.includes('quickmap') ||
                               url.includes('alpha.ca.gov') ||
                               url.includes('roads.dot.ca.gov')
      
        if (isCaltransSource) {
          // Get peak coordinates for API call
          const peak = await prisma.peak.findUnique({
            where: { id: peakId },
            select: { gpsLat: true, gpsLng: true, name: true },
          })
          
          if (peak?.gpsLat && peak?.gpsLng) {
            try {
              // Try Caltrans API first, which will fall back to QuickMap scraping
              const roadStatus = await fetchRoadStatusForPeak(
                peak.gpsLat,
                peak.gpsLng,
                peak.name
              )
              
              // Only create snapshot if we got meaningful content
              // If statusSummary is the generic "could not be retrieved" message, 
              // check if rawText has actual data
              const hasMeaningfulData = roadStatus.statusSummary && 
                !roadStatus.statusSummary.toLowerCase().includes('could not be automatically retrieved') &&
                !roadStatus.statusSummary.toLowerCase().includes('unable to automatically fetch') &&
                roadStatus.statusSummary.length > 20
              
              // Also check if rawText has road condition keywords
              const hasRoadKeywords = /(lane\s+closure|full\s+closure|chain|construction|accident|incident|delay|traffic|road\s+closed|restricted|open|closed)/i.test(roadStatus.rawText)
              
              // If we have meaningful data OR road keywords, store it
              if (hasMeaningfulData || hasRoadKeywords || roadStatus.rawText === '[]') {
                // If rawText is just "[]" (empty array from API), use the statusSummary
                let finalSummary = roadStatus.statusSummary
                if (roadStatus.rawText === '[]' && roadStatus.statusSummary) {
                  finalSummary = roadStatus.statusSummary
                } else if (!hasMeaningfulData && hasRoadKeywords) {
                  // Extract conditions from rawText
                  const conditions: string[] = []
                  if (/lane\s+closure/i.test(roadStatus.rawText)) conditions.push('lane closures')
                  if (/full\s+closure/i.test(roadStatus.rawText)) conditions.push('full closures')
                  if (/chain/i.test(roadStatus.rawText)) conditions.push('chain requirements')
                  if (/construction/i.test(roadStatus.rawText)) conditions.push('construction')
                  if (/accident|incident/i.test(roadStatus.rawText)) conditions.push('incidents')
                  
                  if (conditions.length > 0) {
                    finalSummary = `Road conditions detected: ${conditions.join(', ')}. Check QuickMap for specific locations and details.`
                  }
                }
                
                await prisma.roadStatusSnapshot.create({
                  data: {
                    peakId,
                    peakSourceId: sourceId,
                    rawText: roadStatus.rawText.substring(0, 10000),
                    statusSummary: finalSummary,
                    statusCode: roadStatus.statusCode,
                    fetchedAt: new Date(),
                  },
                })
                return // Success, exit early
              }
            } catch (apiError) {
              console.error(`Caltrans API/QuickMap error for peak ${peak.name}, falling back to scraping:`, apiError)
              // Fall through to scraping
            }
          }
        }
    }
    
    // Default: Scrape the URL (for land managers or if API fails)
    // Use shorter timeout for land manager pages to avoid blocking
    let rawText: string
    try {
      // Use 20 second timeout for land manager pages (shorter than default 30s)
      const result = await scrapeUrl(url, 20000)
      rawText = result.rawText
    } catch (scrapeError) {
      // Always create a snapshot, even on error, so the page has something to show
      const errorMessage = scrapeError instanceof Error ? scrapeError.message : 'Unknown error'
      const is404 = errorMessage.includes('404') || errorMessage.includes('not found')
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Firecrawl request timeout')
      
      let errorSummary: string
      if (is404) {
        errorSummary = `Source URL appears to be invalid or returns a 404 error. Please update the source URL in the admin interface.`
      } else if (isTimeout) {
        errorSummary = `Data fetch timed out. Please check the source for current conditions.`
      } else {
        errorSummary = `Unable to fetch data automatically. Please check the source for current conditions.`
      }
      
      if (sourceType === 'LAND_MANAGER' || sourceType === 'Land Manager') {
        await prisma.landStatusSnapshot.create({
          data: {
            peakId,
            peakSourceId: sourceId,
            rawText: `Error: ${errorMessage}`,
            statusSummary: errorSummary,
            statusCode: 'unknown',
            fetchedAt: new Date(),
          },
        })
      } else if (sourceType === 'ROAD_STATUS') {
        await prisma.roadStatusSnapshot.create({
          data: {
            peakId,
            peakSourceId: sourceId,
            rawText: `Error: ${errorMessage}`,
            statusSummary: errorSummary,
            statusCode: 'unknown',
            fetchedAt: new Date(),
          },
        })
      }
      return // Exit early, we've stored an error snapshot
    }
    
    // Parse status from text
    const parsedStatus = inferStatusFromText(rawText)
    const detailedSummary = generateDetailedSummary(rawText)
    
    // Store snapshot
    if (sourceType === 'LAND_MANAGER' || sourceType === 'Land Manager') {
      await prisma.landStatusSnapshot.create({
        data: {
          peakId,
          peakSourceId: sourceId,
          rawText: rawText.substring(0, 10000), // Limit to 10k chars
          statusSummary: detailedSummary,
          statusCode: parsedStatus.statusCode,
          fetchedAt: new Date(),
        },
      })
    } else {
      await prisma.roadStatusSnapshot.create({
        data: {
          peakId,
          peakSourceId: sourceId,
          rawText: rawText.substring(0, 10000), // Limit to 10k chars
          statusSummary: detailedSummary,
          statusCode: parsedStatus.statusCode,
          fetchedAt: new Date(),
        },
      })
    }
  } catch (error) {
    console.error(`Error fetching status for source ${sourceId}:`, error)
    // Don't throw - we'll just use stale data if available
  }
}

/**
 * Ensure fresh weather data for a peak
 * Fetches on-demand if data is stale or missing
 */
async function ensureFreshWeather(peakId: string): Promise<void> {
  try {
    // Get peak with GPS coordinates
    const peak = await prisma.peak.findUnique({
      where: { id: peakId },
      select: { id: true, name: true, gpsLat: true, gpsLng: true },
    })

    if (!peak || !peak.gpsLat || !peak.gpsLng) {
      return // No GPS coordinates, can't fetch weather
    }

    // Get latest weather snapshot
    const latestWeather = await prisma.weatherSnapshot.findFirst({
      where: { peakId },
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    })

    // Check if weather is stale or missing
    const isWeatherStale = latestWeather
      ? (Date.now() - latestWeather.fetchedAt.getTime()) / (1000 * 60 * 60) > WEATHER_STALE_THRESHOLD_HOURS
      : true

    if (FORCE_REFRESH || isWeatherStale) {
      // Fetch weather in background
      fetchWeatherForPeak(peak.gpsLat, peak.gpsLng, peak.name)
        .then(async (weatherData) => {
          // Store weather snapshot
          await prisma.weatherSnapshot.create({
            data: {
              peakId: peak.id,
              source: 'NOAA',
              rawJson: weatherData.rawJson as any,
              summaryText: weatherData.summaryText,
              fetchedAt: weatherData.fetchedAt,
            },
          })
        })
        .catch((error) => {
          console.error(`Error fetching weather for ${peak.name}:`, error)
        })
    }
  } catch (error) {
    console.error('Error ensuring fresh weather:', error)
  }
}

/**
 * Ensure fresh status data for a peak
 * Fetches on-demand if data is stale or missing
 */
export async function ensureFreshStatus(peakId: string): Promise<void> {
  // Fetch weather first (if needed)
  ensureFreshWeather(peakId).catch((error) => {
    console.error('Error ensuring fresh weather:', error)
  })

  // Get all sources for this peak
  const sources = await prisma.peakSource.findMany({
    where: {
      peakId,
      sourceType: {
        in: ['LAND_MANAGER', 'ROAD_STATUS'],
      },
    },
  })

  // Get latest snapshots with status summaries to check for generic messages
  const [landSnapshots, roadSnapshots] = await Promise.all([
    prisma.landStatusSnapshot.findMany({
      where: { peakId },
      orderBy: { fetchedAt: 'desc' },
      select: { peakSourceId: true, fetchedAt: true, statusSummary: true },
    }),
    prisma.roadStatusSnapshot.findMany({
      where: { peakId },
      orderBy: { fetchedAt: 'desc' },
      select: { peakSourceId: true, fetchedAt: true, statusSummary: true },
    }),
  ])

  // Create maps of latest snapshot per source (with status summary to check for generic messages)
  const latestLandBySource = new Map(
    landSnapshots.map((s) => [s.peakSourceId, { fetchedAt: s.fetchedAt, statusSummary: s.statusSummary }])
  )
  const latestRoadBySource = new Map(
    roadSnapshots.map((s) => [s.peakSourceId, { fetchedAt: s.fetchedAt, statusSummary: s.statusSummary }])
  )

  // Fetch fresh data for stale or missing sources
  const fetchPromises: Promise<void>[] = []

  for (const source of sources) {
    const latestSnapshot =
      source.sourceType === 'LAND_MANAGER'
        ? latestLandBySource.get(source.id)
        : latestRoadBySource.get(source.id)

    const isStaleData = !latestSnapshot || isStale(latestSnapshot.fetchedAt)
    
    // For road status, also check if we have a generic "visit QuickMap" message
    // If so, we should re-fetch even if not stale to try to get actual conditions
    const hasGenericMessage = latestSnapshot?.statusSummary && source.sourceType === 'ROAD_STATUS' && (
      latestSnapshot.statusSummary.toLowerCase().includes('visit quickmap') ||
      latestSnapshot.statusSummary.toLowerCase().includes('call 1-800') ||
      latestSnapshot.statusSummary.toLowerCase().includes('could not be automatically retrieved') ||
      latestSnapshot.statusSummary.toLowerCase().includes('unable to automatically fetch')
    )

    if (FORCE_REFRESH || isStaleData || hasGenericMessage) {
      // Fetch in background (don't await to avoid blocking)
      // Wrap in error handler to prevent unhandled promise rejections
      fetchPromises.push(
        fetchStatusForSource(peakId, source.id, source.sourceType, source.url)
          .catch((error) => {
            // Log error but don't throw - this is background fetching
            console.error(`Background fetch failed for ${source.label}:`, error.message)
          })
      )
    }
  }

  // Wait for all fetches to complete (but don't block the page render)
  // We'll return immediately and let them fetch in the background
  Promise.all(fetchPromises).catch((error) => {
    console.error('Error fetching fresh status data:', error)
  })
}

