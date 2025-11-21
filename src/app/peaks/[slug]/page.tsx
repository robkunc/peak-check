import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { ensureFreshStatus } from '@/lib/fetch-status-on-demand'
import NotesSection from './notes-section'
import WeatherPanel from '@/components/weather-panel'
import Link from 'next/link'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Format land status summary for better readability
 */
function formatLandStatusSummary(text: string): string {
  if (!text) return ''
  
  let formatted = text
  
  // Extract and format Fire Restrictions
  // Look for patterns like "Fire Restrictions for [Location]" in the text
  const restrictionPattern = /Fire\s+Restrictions?\s+for\s+([A-Z][A-Za-z\s]+?)(?=\s*(?:Fire\s+Restrictions|Gifford|Madre|Fire\s+Danger|$|[A-Z][a-z]+\s+Fire))/gi
  const restrictions: string[] = []
  let restrictionMatch
  while ((restrictionMatch = restrictionPattern.exec(formatted)) !== null) {
    const location = restrictionMatch[1].trim()
    if (location.length > 5 && location.length < 100) {
      restrictions.push(`Fire Restrictions: ${location}`)
    }
  }
  
  // Extract fire names (Gifford Fire, Madre Fire, etc.)
  const firePattern = /\b(Gifford|Madre|Creek|Bear|Pine|Squirrel|Eagle|Thunder|Lightning|Wild|Canyon|Mountain|Peak|Ridge|Valley|Summit)\s+Fire\b/gi
  const fires: string[] = []
  let fireMatch
  while ((fireMatch = firePattern.exec(formatted)) !== null) {
    if (!fires.includes(fireMatch[0])) {
      fires.push(fireMatch[0])
    }
  }
  
  // If we found restrictions or fires, rebuild the alerts section
  if (restrictions.length > 0 || fires.length > 0) {
    const alertItems = [...restrictions, ...fires]
    formatted = formatted.replace(/Alerts:[^.]*?(?=\.\s*Fire\s+Danger\s+Status|$)/gi, `Alerts: ${alertItems.join(', ')}`)
  }
  
  // Ensure Fire Danger Status is on a new line
  formatted = formatted.replace(/([^.])\s*\.\s*Fire\s+Danger\s+Status:/gi, '$1\n\nFire Danger Status:')
  
  // Clean up extra spaces and normalize
  formatted = formatted.replace(/\s+/g, ' ').trim()
  formatted = formatted.replace(/\s*\.\s*\./g, '.')
  
  // Remove trailing "Los Padr" or similar truncations
  formatted = formatted.replace(/\s+Los\s+Padr\s*$/i, '')
  formatted = formatted.replace(/\s+Los\s+Padres\s+National\s+Forest\s*$/i, '')
  
  // Add line breaks for readability (convert periods to line breaks)
  formatted = formatted.replace(/(Alerts:)/g, '$1')
  formatted = formatted.replace(/\.\s*(Fire\s+Danger\s+Status:)/gi, '\n\n$1')
  
  return formatted.trim()
}

/**
 * Clean markdown and HTML from status summary for display
 * This is a safety net in case old data still has markdown
 */
function cleanStatusSummaryForDisplay(text: string | null): string {
  if (!text) return ''
  
  let cleaned = text
  
  // Remove markdown images
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]*\)/g, ' ')
  cleaned = cleaned.replace(/!\[([^\]]*)\]/g, ' ')
  
  // Remove markdown links but keep text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  
  // Remove markdown headers
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, ' ')
  
  // Remove markdown bold/italic
  cleaned = cleaned.replace(/\*\*([^\*]+)\*\*/g, '$1')
  cleaned = cleaned.replace(/\*([^\*]+)\*/g, '$1')
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1')
  
  // Remove markdown code
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ')
  cleaned = cleaned.replace(/`[^`]+`/g, ' ')
  
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ' ')
  
  // Remove common boilerplate - be very aggressive
  const boilerplate = [
    /Skip to main content/gi,
    /Skip to content/gi,
    /Official websites use \.gov/gi,
    /Secure \.gov websites use HTTPS/gi,
    /A \.gov website belongs to/gi,
    /A \.gov website belongs to an official government organization/gi,
    /A lock.*means you've safely connected/gi,
    /A lock.*or https.*means you've safely connected/gi,
    /LockLocked padlock/gi,
    /Lock.*padlock/gi,
    /Know before you go/gi,
    /National Weather Service/gi,
    /Caltrans Social Media/gi,
    /QuickMap Real-time Travel Information/gi,
    /Check Current Highway Conditions/gi,
    /Enter Highway Number/gi,
    /You can also call.*for current highway conditions/gi,
    /You can also call.*for current/gi,
    /Road Information/gi,
    /Mobile/gi,
    /Dot gov/gi,
    /Https/gi,
    /means you've safely connected/gi,
    /safely connected to the/gi,
    /belongs to an official government organization/gi,
    /United States/gi,
    /or https.*means/gi,
  ]
  
  for (const pattern of boilerplate) {
    cleaned = cleaned.replace(pattern, ' ')
  }
  
  // Clean whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  // If after cleaning we have very little left, return a default message
  if (cleaned.length < 20) {
    return 'Status information available. Please check source for details.'
  }
  
  return cleaned
}

export default async function PeakConditionsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  const { slug } = await params

  const peak = await prisma.peak.findUnique({
    where: { slug },
  })

  if (!peak) {
    notFound()
  }

  // Fetch latest weather snapshot first
  let latestWeather = await prisma.weatherSnapshot.findFirst({
    where: { peakId: peak.id },
    orderBy: { fetchedAt: 'desc' },
  })

  // If no weather data exists and we have GPS coordinates, fetch it now (don't wait)
  if (!latestWeather && peak.gpsLat && peak.gpsLng) {
    try {
      const { fetchWeatherForPeak } = await import('@/lib/noaa-api')
      const weatherData = await fetchWeatherForPeak(peak.gpsLat, peak.gpsLng, peak.name)
      
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
      
      // Re-fetch to get the newly created snapshot
      latestWeather = await prisma.weatherSnapshot.findFirst({
        where: { peakId: peak.id },
        orderBy: { fetchedAt: 'desc' },
      })
    } catch (error) {
      console.error('Error fetching weather on-demand:', error)
      // Continue with no weather data
    }
  }

  // Get all sources for this peak
  const allSources = await prisma.peakSource.findMany({
    where: {
      peakId: peak.id,
      sourceType: {
        in: ['LAND_MANAGER', 'ROAD_STATUS'],
      },
    },
  })

  // Fetch latest land status snapshots first
  let landStatusSnapshots = await prisma.landStatusSnapshot.findMany({
    where: { peakId: peak.id },
    orderBy: { fetchedAt: 'desc' },
    include: {
      peakSource: true,
    },
    take: 100,
  })

  // Fetch latest road status snapshots
  let roadStatusSnapshots = await prisma.roadStatusSnapshot.findMany({
    where: { peakId: peak.id },
    orderBy: { fetchedAt: 'desc' },
    include: {
      peakSource: true,
    },
    take: 100,
  })

  // Check if we're missing data for any sources
  const landSourceIds = new Set(landStatusSnapshots.map(s => s.peakSourceId))
  const roadSourceIds = new Set(roadStatusSnapshots.map(s => s.peakSourceId))
  
  const missingLandSources = allSources.filter(s => 
    s.sourceType === 'LAND_MANAGER' && !landSourceIds.has(s.id)
  )
  const missingRoadSources = allSources.filter(s => 
    s.sourceType === 'ROAD_STATUS' && !roadSourceIds.has(s.id)
  )

  // If we have missing sources, fetch them synchronously with a timeout
  if (missingLandSources.length > 0 || missingRoadSources.length > 0) {
    const { fetchStatusForSource } = await import('@/lib/fetch-status-on-demand')
    
    // Fetch missing sources with a timeout to avoid hanging
    const fetchPromises: Promise<void>[] = []
    
    for (const source of [...missingLandSources, ...missingRoadSources]) {
      // Fetch each source, creating a placeholder if it times out
      const fetchPromise = fetchStatusForSource(peak.id, source.id, source.sourceType, source.url)
        .catch(async (error) => {
          // If fetch fails or times out, create a placeholder snapshot
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Firecrawl request timeout')
          const placeholderSummary = isTimeout
            ? 'Data fetch timed out. Please check the source for current conditions.'
            : 'Unable to fetch data automatically. Please check the source for current conditions.'
          
          // Create placeholder snapshot so the page shows something
          if (source.sourceType === 'LAND_MANAGER') {
            await prisma.landStatusSnapshot.create({
              data: {
                peakId: peak.id,
                peakSourceId: source.id,
                rawText: `Error: ${errorMessage}`,
                statusSummary: placeholderSummary,
                statusCode: 'unknown',
                fetchedAt: new Date(),
              },
            })
          } else if (source.sourceType === 'ROAD_STATUS') {
            await prisma.roadStatusSnapshot.create({
              data: {
                peakId: peak.id,
                peakSourceId: source.id,
                rawText: `Error: ${errorMessage}`,
                statusSummary: placeholderSummary,
                statusCode: 'unknown',
                fetchedAt: new Date(),
              },
            })
          }
        })
      
      // Add timeout wrapper - 6 seconds per source to avoid long waits
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn(`Timeout fetching ${source.label} for ${peak.name}`)
          resolve()
        }, 6000) // 6 second timeout per source
      })
      
      fetchPromises.push(Promise.race([fetchPromise, timeoutPromise]))
    }
    
    // Wait for all fetches with a maximum total timeout of 10 seconds
    try {
      await Promise.race([
        Promise.all(fetchPromises),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            console.warn(`Total timeout reached for ${peak.name}`)
            resolve()
          }, 10000) // 10 second total timeout
        }),
      ])
    } catch (error) {
      // Don't fail the page if fetching fails
      console.error('Error fetching missing status:', error)
    }
    
    // Re-fetch snapshots after fetching
    [landStatusSnapshots, roadStatusSnapshots] = await Promise.all([
      prisma.landStatusSnapshot.findMany({
        where: { peakId: peak.id },
        orderBy: { fetchedAt: 'desc' },
        include: { peakSource: true },
        take: 100,
      }),
      prisma.roadStatusSnapshot.findMany({
        where: { peakId: peak.id },
        orderBy: { fetchedAt: 'desc' },
        include: { peakSource: true },
        take: 100,
      }),
    ])
  } else {
    // Data exists - refresh in background without blocking
    ensureFreshStatus(peak.id).catch((error) => {
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Firecrawl request timeout'))) {
        return
      }
      console.error('Error ensuring fresh status:', error)
    })
  }

  // Get the latest snapshot per source (most recent first)
  const landStatuses = Array.from(
    new Map(landStatusSnapshots.map((s) => [s.peakSourceId, s])).values()
  )

  const roadStatuses = Array.from(
    new Map(roadStatusSnapshots.map((s) => [s.peakSourceId, s])).values()
  )

  // Fetch recent manual notes (first page)
  const notes = await prisma.manualNote.findMany({
    where: { peakId: peak.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  const notesTotal = await prisma.manualNote.count({
    where: { peakId: peak.id },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/peaks"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Peaks
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{peak.name}</h1>
          <div className="flex gap-4 text-gray-600">
            {peak.region && <span className="text-lg">{peak.region}</span>}
            {peak.gpsLat && peak.gpsLng && (
              <span className="text-lg">
                {peak.gpsLat.toFixed(4)}°, {peak.gpsLng.toFixed(4)}°
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Weather Section */}
          <WeatherPanel
            summaryText={latestWeather?.summaryText || null}
            fetchedAt={latestWeather?.fetchedAt ? new Date(latestWeather.fetchedAt) : null}
            rawJson={(latestWeather?.rawJson as any) || null}
          />

          {/* Land Manager Status Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Land Manager Status
            </h2>
            {landStatuses.length > 0 ? (
              <div className="space-y-4">
                {landStatuses.map((status) => (
                  <div key={status.id} className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {status.peakSource.label}
                    </h3>
                    {status.statusSummary ? (
                      <div className="text-gray-700 mb-1 text-sm leading-relaxed whitespace-pre-line">
                        {formatLandStatusSummary(cleanStatusSummaryForDisplay(status.statusSummary))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic mb-1 text-sm">
                        No summary available. Please check the source for current status.
                      </p>
                    )}
                    {status.statusCode && (
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                        status.statusCode === 'open'
                          ? 'bg-green-100 text-green-800'
                          : status.statusCode === 'closed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {status.statusCode}
                      </span>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      Last updated: {new Date(status.fetchedAt).toLocaleString()}
                    </p>
                    <a
                      href={status.peakSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View source →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-lg">
                No land manager data configured yet
              </p>
            )}
          </div>

          {/* Road Status Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Road Status</h2>
            {roadStatuses.length > 0 ? (
              <div className="space-y-4">
                {roadStatuses.map((status) => (
                  <div key={status.id} className="border-l-4 border-orange-500 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {status.peakSource.label}
                    </h3>
                    {status.statusSummary ? (
                      <div className="text-gray-700 mb-1 text-sm leading-relaxed whitespace-pre-line">
                        {formatLandStatusSummary(cleanStatusSummaryForDisplay(status.statusSummary))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic mb-1 text-sm">
                        No summary available. Please check the source for current status.
                      </p>
                    )}
                    {status.statusCode && (
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                        status.statusCode === 'open'
                          ? 'bg-green-100 text-green-800'
                          : status.statusCode === 'closed'
                          ? 'bg-red-100 text-red-800'
                          : status.statusCode === 'chains_required'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {status.statusCode.replace('_', ' ')}
                      </span>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      Last updated: {new Date(status.fetchedAt).toLocaleString()}
                    </p>
                    <a
                      href={status.peakSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View source →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-lg">
                No road status data configured yet
              </p>
            )}
          </div>

          {/* Manual Notes Section */}
          <NotesSection
            peakId={peak.id}
            initialNotes={notes.map((note) => ({
              id: note.id,
              text: note.text,
              createdAt: note.createdAt.toISOString(),
              user: {
                name: note.user.name,
                email: note.user.email,
              },
            }))}
            initialTotal={notesTotal}
          />
        </div>
      </div>
    </div>
  )
}


