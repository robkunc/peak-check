/**
 * NOAA National Weather Service API Client
 * 
 * Uses the free NWS API (api.weather.gov) which doesn't require an API key.
 * 
 * API Documentation: https://www.weather.gov/documentation/services-web-api
 */

interface GridPoint {
  gridId: string
  gridX: number
  gridY: number
}

interface ForecastPeriod {
  name: string
  startTime: string
  endTime: string
  isDaytime: boolean
  temperature: number
  temperatureUnit: string
  windSpeed: string
  windDirection: string
  shortForecast: string
  detailedForecast: string
  icon: string
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[]
  }
}

interface CurrentConditions {
  temperature: number | null
  temperatureUnit: string | null
  windSpeed: string | null
  windDirection: string | null
  conditions: string | null
  icon: string | null
}

/**
 * Get grid point coordinates from lat/lng
 * This is required before fetching forecast data
 */
async function getGridPoint(lat: number, lng: number): Promise<GridPoint> {
  const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Sierra Club Peak Conditions Assistant (contact: your-email@example.com)',
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get grid point: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    gridId: data.properties.gridId,
    gridX: data.properties.gridX,
    gridY: data.properties.gridY,
  }
}

/**
 * Get forecast for a grid point
 */
async function getForecast(gridPoint: GridPoint): Promise<ForecastPeriod[]> {
  const url = `https://api.weather.gov/gridpoints/${gridPoint.gridId}/${gridPoint.gridX},${gridPoint.gridY}/forecast`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Sierra Club Peak Conditions Assistant (contact: your-email@example.com)',
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get forecast: ${response.status} ${response.statusText}`)
  }

  const data: ForecastResponse = await response.json()
  return data.properties.periods
}

/**
 * Get current conditions for a grid point
 * Tries to get observed conditions from a nearby station, prioritizing higher elevation stations
 */
async function getCurrentConditions(
  gridPoint: GridPoint,
  peakLat?: number,
  peakLng?: number,
  peakName?: string
): Promise<CurrentConditions> {
  // First, try to get observed conditions from a nearby station
  try {
    const stationsUrl = `https://api.weather.gov/gridpoints/${gridPoint.gridId}/${gridPoint.gridX},${gridPoint.gridY}/stations`
    const stationsResponse = await fetch(stationsUrl, {
      headers: {
        'User-Agent': 'Sierra Club Peak Conditions Assistant (contact: your-email@example.com)',
        'Accept': 'application/json',
      },
    })

    if (stationsResponse.ok) {
      const stationsData = await stationsResponse.json()
      const stations = stationsData.features || []
      
      // Score and sort stations by relevance
      interface ScoredStation {
        station: any
        score: number
        elevation: number
        stationId: string
      }
      
      const scoredStations: ScoredStation[] = stations
        .map((station: any) => {
          const props = station.properties || {}
          const stationId = props.stationIdentifier || ''
          const elevation = props.elevation?.value || 0 // in meters
          const stationName = (props.name || '').toLowerCase()
          const stationLat = station.geometry?.coordinates?.[1]
          const stationLng = station.geometry?.coordinates?.[0]
          
          let score = 0
          
          // Strongly prefer stations with higher elevation (closer to peak elevation)
          // This is important for mountain peaks where elevation makes a huge difference
          score += elevation * 0.5 // Increased weight for elevation
          
          // Prefer stations whose name contains the peak name
          if (peakName) {
            const peakNameLower = peakName.toLowerCase()
            const nameParts = peakNameLower.split(/\s+/)
            for (const part of nameParts) {
              if (part.length > 3 && stationName.includes(part)) {
                score += 1000
                break
              }
            }
          }
          
          // Prefer stations closer to the peak coordinates
          if (peakLat && peakLng && stationLat && stationLng) {
            const distance = Math.sqrt(
              Math.pow(stationLat - peakLat, 2) + Math.pow(stationLng - peakLng, 2)
            )
            score += 100 / (1 + distance * 10) // Closer = higher score
          }
          
          return { station, score, elevation, stationId }
        })
        .sort((a: ScoredStation, b: ScoredStation) => b.score - a.score) // Sort by score descending
      
      // Try to get observations from the best stations (up to 10, to find one with data)
      for (const { station, stationId, elevation } of scoredStations.slice(0, 10)) {
        if (stationId) {
          try {
            const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`
            const obsResponse = await fetch(obsUrl, {
              headers: {
                'User-Agent': 'Sierra Club Peak Conditions Assistant (contact: your-email@example.com)',
                'Accept': 'application/json',
              },
            })

            if (obsResponse.ok) {
              const obsData = await obsResponse.json()
              const temp = obsData.properties?.temperature?.value
              const windSpeed = obsData.properties?.windSpeed?.value
              const windDir = obsData.properties?.windDirection?.value
              const textDescription = obsData.properties?.textDescription
              const timestamp = obsData.properties?.timestamp

              // Only use observations that are recent (within last 6 hours)
              if (timestamp) {
                const obsTime = new Date(timestamp)
                const ageHours = (Date.now() - obsTime.getTime()) / (1000 * 60 * 60)
                if (ageHours > 6) {
                  continue // Skip stale observations
                }
              }

              if (temp !== null && temp !== undefined) {
                return {
                  temperature: Math.round((temp * 9/5) + 32), // Convert C to F
                  temperatureUnit: 'F',
                  windSpeed: windSpeed ? `${Math.round(windSpeed * 2.237)} mph` : null, // Convert m/s to mph
                  windDirection: windDir ? `${windDir}°` : null,
                  conditions: textDescription || null,
                  icon: null,
                }
              }
            }
          } catch (e) {
            // Continue to next station
            continue
          }
        }
      }
    }
  } catch (error) {
    // Fall through to hourly forecast
  }

  // Fallback to hourly forecast
  try {
    const url = `https://api.weather.gov/gridpoints/${gridPoint.gridId}/${gridPoint.gridX},${gridPoint.gridY}/forecast/hourly`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Sierra Club Peak Conditions Assistant (contact: your-email@example.com)',
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      const currentPeriod = data.properties.periods[0]

      return {
        temperature: currentPeriod.temperature || null,
        temperatureUnit: currentPeriod.temperatureUnit || null,
        windSpeed: currentPeriod.windSpeed || null,
        windDirection: currentPeriod.windDirection || null,
        conditions: currentPeriod.shortForecast || null,
        icon: currentPeriod.icon || null,
      }
    }
  } catch (error) {
    // Return null values if all methods fail
  }

  return {
    temperature: null,
    temperatureUnit: null,
    windSpeed: null,
    windDirection: null,
    conditions: null,
    icon: null,
  }
}

/**
 * Generate a human-readable weather summary
 */
function generateWeatherSummary(
  current: CurrentConditions,
  forecast: ForecastPeriod[]
): string {
  const parts: string[] = []

  // Current conditions
  if (current.temperature !== null) {
    parts.push(`Current: ${current.temperature}°${current.temperatureUnit || 'F'}`)
  }
  if (current.conditions) {
    parts.push(current.conditions)
  }
  if (current.windSpeed) {
    parts.push(`Wind: ${current.windSpeed}`)
  }

  // Find today's forecast period (look for daytime period)
  const now = new Date()
  let todayForecast: ForecastPeriod | null = null
  let tomorrowForecast: ForecastPeriod | null = null

  for (const period of forecast) {
    const periodStart = new Date(period.startTime)
    const periodEnd = new Date(period.endTime)
    
    // Check if this period is today and is daytime
    if (periodStart <= now && now <= periodEnd && period.isDaytime) {
      todayForecast = period
    }
    // Or if it's the next daytime period after now
    else if (periodStart > now && period.isDaytime && !todayForecast) {
      todayForecast = period
    }
    // Find tomorrow's daytime period
    else if (periodStart > now && period.isDaytime && todayForecast && !tomorrowForecast) {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      if (periodStart.toDateString() === tomorrow.toDateString()) {
        tomorrowForecast = period
      }
    }
  }

  // Fallback: use first period if we didn't find today
  if (!todayForecast && forecast.length > 0) {
    todayForecast = forecast[0]
  }

  // Fallback: use second period if we didn't find tomorrow
  if (!tomorrowForecast && forecast.length > 1) {
    tomorrowForecast = forecast[1]
  }

  // Today's forecast
  if (todayForecast) {
    parts.push(`${todayForecast.name}: ${todayForecast.shortForecast}, High ${todayForecast.temperature}°${todayForecast.temperatureUnit}`)
  }

  // Tomorrow's forecast
  if (tomorrowForecast) {
    parts.push(`${tomorrowForecast.name}: ${tomorrowForecast.shortForecast}, High ${tomorrowForecast.temperature}°${tomorrowForecast.temperatureUnit}`)
  }

  return parts.join('. ') || 'Weather data unavailable'
}

/**
 * Main function to fetch weather data for a peak
 */
export async function fetchWeatherForPeak(
  lat: number,
  lng: number,
  peakName?: string
) {
  try {
    // Get grid point
    const gridPoint = await getGridPoint(lat, lng)

    // Fetch forecast and current conditions in parallel
    const [forecast, current] = await Promise.all([
      getForecast(gridPoint),
      getCurrentConditions(gridPoint, lat, lng, peakName),
    ])

    // Generate summary
    const summary = generateWeatherSummary(current, forecast)

    return {
      rawJson: {
        gridPoint,
        current,
        forecast: forecast.slice(0, 7), // Store first 7 periods (about 3-4 days)
      },
      summaryText: summary,
      fetchedAt: new Date(),
    }
  } catch (error) {
    console.error('Error fetching weather:', error)
    throw error
  }
}

