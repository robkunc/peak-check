/**
 * Caltrans Road Status API Client
 * 
 * Uses the Alpha.CA.gov public Caltrans lane closure API and QuickMap for road status information.
 * Falls back to QuickMap scraping if the API is unavailable.
 * 
 * Note: CWWP2 API requires admin access and is not used here.
 * 
 * API Documentation: https://alpha.ca.gov/
 * QuickMap: https://quickmap.dot.ca.gov/
 */

interface LaneClosure {
  id: string
  route: string
  direction: string
  location: string
  description: string
  startDate: string
  endDate: string
  closureType: string
  latitude?: number
  longitude?: number
}

interface CaltransAPIResponse {
  features: Array<{
    properties: {
      route?: string
      direction?: string
      location?: string
      description?: string
      start_date?: string
      end_date?: string
      closure_type?: string
    }
    geometry?: {
      coordinates?: [number, number] // [lng, lat]
    }
  }>
}

/**
 * Fetch lane closures from Caltrans API using bounding box
 * @param lat Latitude
 * @param lng Longitude
 * @param radiusKm Radius in kilometers around the point (default: 50km)
 */
export async function fetchLaneClosuresByBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number = 50
): Promise<LaneClosure[]> {
  try {
    // Calculate bounding box (rough approximation)
    // 1 degree latitude ≈ 111 km
    const latDelta = radiusKm / 111
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180))
    
    const minLat = lat - latDelta
    const maxLat = lat + latDelta
    const minLng = lng - lngDelta
    const maxLng = lng + lngDelta
    
    // Try Alpha.CA.gov public API endpoints
    // Note: CWWP2 requires admin access, so we only use public APIs
    const possibleEndpoints = [
      `https://api.alpha.ca.gov/caltrans/lane-closures?bbox=${minLng},${minLat},${maxLng},${maxLat}`,
      `https://api.alpha.ca.gov/caltrans/road-closures?bbox=${minLng},${minLat},${maxLng},${maxLat}`,
    ]
    
    let data: CaltransAPIResponse | null = null
    
    for (const apiUrl of possibleEndpoints) {
      try {
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
          },
          next: { revalidate: 300 }, // Cache for 5 minutes (API updates every 5 minutes)
        })
        
        if (response.ok) {
          data = await response.json()
          break // Success, exit loop
        }
      } catch (error) {
        // Try next endpoint
        continue
      }
    }
    
    if (!data) {
      // If all API endpoints fail, return empty array
      // We'll fall back to scraping QuickMap
      console.warn('Caltrans public API endpoints unavailable, falling back to QuickMap scraping')
      return []
    }
    
    // Transform API response to our format
    const closures: LaneClosure[] = data.features.map((feature, index) => {
      const props = feature.properties
      const coords = feature.geometry?.coordinates
      
      return {
        id: (props.route || 'unknown') + '-' + index,
        route: props.route || 'Unknown',
        direction: props.direction || '',
        location: props.location || '',
        description: props.description || '',
        startDate: props.start_date || '',
        endDate: props.end_date || '',
        closureType: props.closure_type || '',
        latitude: coords ? coords[1] : undefined,
        longitude: coords ? coords[0] : undefined,
      }
    })
    
    return closures
  } catch (error) {
    console.error('Error fetching Caltrans lane closures:', error)
    // Return empty array on error - we'll fall back to scraping
    return []
  }
}

/**
 * Generate a summary of lane closures for a peak
 */
export function generateRoadStatusSummary(closures: LaneClosure[]): {
  summary: string
  statusCode: 'open' | 'closed' | 'restricted' | 'chains_required' | 'unknown'
} {
  if (closures.length === 0) {
    return {
      summary: 'No active lane closures reported in this area.',
      statusCode: 'open',
    }
  }
  
  // Group closures by type
  const activeClosures = closures.filter(c => {
    // Check if closure is currently active
    const now = new Date()
    const start = c.startDate ? new Date(c.startDate) : null
    const end = c.endDate ? new Date(c.endDate) : null
    
    if (start && end) {
      return now >= start && now <= end
    }
    // If no dates, assume active
    return true
  })
  
  if (activeClosures.length === 0) {
    return {
      summary: 'No active lane closures reported in this area.',
      statusCode: 'open',
    }
  }
  
  // Check for full closures
  const fullClosures = activeClosures.filter(c => 
    c.closureType?.toLowerCase().includes('full') ||
    c.description?.toLowerCase().includes('closed') ||
    c.description?.toLowerCase().includes('closure')
  )
  
  if (fullClosures.length > 0) {
    const routes = [...new Set(fullClosures.map(c => c.route).filter(Boolean))]
    return {
      summary: `Road closures reported on ${routes.join(', ')}. ${fullClosures.length} active closure(s). Check source for details.`,
      statusCode: 'closed',
    }
  }
  
  // Check for restrictions (chains, one lane, etc.)
  const restrictions = activeClosures.filter(c =>
    c.description?.toLowerCase().includes('chain') ||
    c.description?.toLowerCase().includes('restriction') ||
    c.description?.toLowerCase().includes('one lane')
  )
  
  if (restrictions.length > 0) {
    const routes = [...new Set(restrictions.map(c => c.route).filter(Boolean))]
    return {
      summary: `Road restrictions reported on ${routes.join(', ')}. ${restrictions.length} active restriction(s). Check source for details.`,
      statusCode: restrictions.some(c => c.description?.toLowerCase().includes('chain'))
        ? 'chains_required'
        : 'restricted',
    }
  }
  
  // General lane closures
  const routes = [...new Set(activeClosures.map(c => c.route).filter(Boolean))]
  return {
    summary: `${activeClosures.length} active lane closure(s) reported on ${routes.join(', ')}. Check source for details.`,
    statusCode: 'restricted',
  }
}

/**
 * Fetch road status for a peak using Caltrans API
 * Falls back to QuickMap scraping if API is unavailable
 */
export async function fetchRoadStatusForPeak(
  lat: number,
  lng: number,
  peakName: string
): Promise<{
  rawText: string
  statusSummary: string
  statusCode: 'open' | 'closed' | 'restricted' | 'chains_required' | 'unknown'
  rawJson?: any
}> {
  // Try API first
  try {
    const closures = await fetchLaneClosuresByBoundingBox(lat, lng, 50)
    
    if (closures.length > 0) {
      const { summary, statusCode } = generateRoadStatusSummary(closures)
      return {
        rawText: JSON.stringify(closures, null, 2),
        statusSummary: summary,
        statusCode,
        rawJson: closures,
      }
    }
    // If no closures found, that's still valid data - return it
    return {
      rawText: JSON.stringify(closures, null, 2),
      statusSummary: 'No active lane closures reported in this area.',
      statusCode: 'open',
      rawJson: closures,
    }
  } catch (apiError) {
    // API failed, fall through to QuickMap scraping
    console.warn('Caltrans public API endpoints unavailable, falling back to QuickMap scraping')
  }
  
  // Fallback: Scrape QuickMap to get actual road conditions
  // QuickMap is a dynamic app, so we'll try multiple approaches
  // Use a shorter timeout for QuickMap since it often times out
  try {
    // Import firecrawl dynamically to avoid circular dependencies
    const { scrapeUrl } = await import('./firecrawl-client')
    const { inferStatusFromText, generateDetailedSummary } = await import('./status-parser')
    
    // Try QuickMap with coordinates - this should show conditions near the peak
    const quickMapUrl = `https://quickmap.dot.ca.gov/?extent=${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}`
    
    try {
      // Use shorter timeout for QuickMap (15 seconds instead of 30)
      const { rawText } = await scrapeUrl(quickMapUrl, 15000)
      
      // Parse the scraped text to extract road conditions
      const parsedStatus = inferStatusFromText(rawText)
      const detailedSummary = generateDetailedSummary(rawText)
      
      // Check if we got meaningful content (not just navigation/boilerplate)
      // Be more lenient - accept content if it has any road condition indicators
      const hasRealContent = detailedSummary && 
                             detailedSummary.length > 30 && // Lower threshold
                             !detailedSummary.toLowerCase().includes('check source') &&
                             !detailedSummary.toLowerCase().includes('visit quickmap') &&
                             !detailedSummary.toLowerCase().includes('call 1-800') &&
                             !detailedSummary.toLowerCase().includes('enter highway number')
      
      // Also check if the raw text has road condition keywords even if summary is short
      const hasRoadKeywords = /(lane\s+closure|full\s+closure|chain|construction|accident|incident|delay|traffic|road\s+closed|restricted)/i.test(rawText)
      
      if ((hasRealContent || hasRoadKeywords) && parsedStatus.statusCode !== 'unknown') {
        // If summary is too short but we have keywords, create a better summary
        let finalSummary = detailedSummary
        if (detailedSummary.length < 50 && hasRoadKeywords) {
          // Extract actual conditions from raw text
          const conditions: string[] = []
          if (/lane\s+closure/i.test(rawText)) conditions.push('lane closures')
          if (/full\s+closure/i.test(rawText)) conditions.push('full closures')
          if (/chain/i.test(rawText)) conditions.push('chain requirements')
          if (/construction/i.test(rawText)) conditions.push('construction')
          if (/accident|incident/i.test(rawText)) conditions.push('incidents')
          
          if (conditions.length > 0) {
            finalSummary = `Road conditions detected: ${conditions.join(', ')}. Check QuickMap for specific locations and details.`
          }
        }
        
        return {
          rawText: rawText.substring(0, 10000), // Limit to 10k chars
          statusSummary: finalSummary,
          statusCode: parsedStatus.statusCode as 'open' | 'closed' | 'restricted' | 'chains_required' | 'unknown',
        }
      }
    } catch (scrapeError) {
      // Don't log timeout errors - they're expected for QuickMap
      if (scrapeError instanceof Error && !scrapeError.message.includes('timeout')) {
        console.error('Error scraping QuickMap URL:', scrapeError)
      }
    }
    
      // If QuickMap scraping didn't work, try scraping the main QuickMap page
      // and look for road conditions in the area
      try {
        const mainQuickMapUrl = 'https://quickmap.dot.ca.gov/'
        // Use shorter timeout for main QuickMap page too
        const { rawText } = await scrapeUrl(mainQuickMapUrl, 15000)
      
      // Look for road condition keywords in the scraped content
      const conditionKeywords = [
        'chain control', 'chains required', 'road closed', 'lane closure',
        'traffic', 'construction', 'accident', 'incident', 'delay'
      ]
      
      const hasConditions = conditionKeywords.some(keyword => 
        rawText.toLowerCase().includes(keyword)
      )
      
      if (hasConditions) {
        const parsedStatus = inferStatusFromText(rawText)
        const detailedSummary = generateDetailedSummary(rawText)
        
        // Only use if we got meaningful content
        if (detailedSummary && detailedSummary.length > 50 && parsedStatus.statusCode !== 'unknown') {
          return {
            rawText: rawText.substring(0, 10000),
            statusSummary: detailedSummary,
            statusCode: parsedStatus.statusCode as 'open' | 'closed' | 'restricted' | 'chains_required' | 'unknown',
          }
        }
      }
    } catch (mainError) {
      // Don't log timeout errors - they're expected for QuickMap
      if (mainError instanceof Error && !mainError.message.includes('timeout')) {
        console.error('Error scraping main QuickMap page:', mainError)
      }
    }
  } catch (error) {
    // Don't log timeout errors - they're expected for QuickMap
    if (error instanceof Error && !error.message.includes('timeout')) {
      console.error('Error in QuickMap fallback:', error)
    }
  }
  
  // Last resort: Return a message directing to QuickMap
  // But make it clear this is because we couldn't get the data automatically
  return {
    rawText: `Road status data for ${peakName}. Unable to automatically fetch conditions from QuickMap.`,
    statusSummary: `Road conditions near ${peakName} could not be automatically retrieved. Please check QuickMap (quickmap.dot.ca.gov) or call 1-800-427-7623 for current conditions.`,
    statusCode: 'unknown',
  }
}

