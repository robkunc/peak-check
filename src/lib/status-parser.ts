/**
 * Status Parser
 * 
 * Parses scraped text to infer status codes and summaries for land manager and road status.
 */

export type StatusCode = 'open' | 'closed' | 'restricted' | 'chains_required' | 'unknown'

export interface ParsedStatus {
  statusCode: StatusCode
  summary: string
}

/**
 * Infer status from scraped text
 */
export function inferStatusFromText(rawText: string): ParsedStatus {
  const text = rawText.toLowerCase()

  // Check for restricted access FIRST (before closed) since it's more specific
  // Construction, accidents, incidents, lane closures = restricted (not closed)
  if (
    text.includes('restricted') ||
    text.includes('limited access') ||
    text.includes('permit required') ||
    text.includes('special restrictions') ||
    text.includes('lane closure') ||
    text.includes('construction') ||
    text.includes('accident') ||
    text.includes('incident') ||
    text.includes('delay')
  ) {
    return {
      statusCode: 'restricted',
      summary: 'Road conditions may affect access (see source for details).',
    }
  }

  // Check for chains required
  if (
    text.includes('chains required') ||
    text.includes('chains are required') ||
    text.includes('chain control') ||
    text.includes('snow chains')
  ) {
    return {
      statusCode: 'chains_required',
      summary: 'Chains required on access roads.',
    }
  }

  // Check for closed/closure keywords - be specific to avoid false positives
  // "Full Closure" or "Road Closed" means closed, but "Lane Closure" or "Construction" doesn't
  // Also exclude "restricted" since we already checked for that above
  if (
    text.includes('road closed') ||
    text.includes('fully closed') ||
    text.includes('temporarily closed') ||
    text.includes('permanently closed') ||
    text.includes('full closure') ||
    (text.includes('closed') && 
     !text.includes('lane closure') && 
     !text.includes('construction') &&
     !text.includes('restricted'))
  ) {
    return {
      statusCode: 'closed',
      summary: 'Road closed (see source for details).',
    }
  }

  // Check for open status
  if (
    text.includes('open') ||
    text.includes('accessible') ||
    text.includes('available')
  ) {
    return {
      statusCode: 'open',
      summary: 'Open (see source for details).',
    }
  }

  // Default to unknown if we can't determine
  return {
    statusCode: 'unknown',
    summary: 'Status unclear; please read source for details.',
  }
}

/**
 * Clean text by removing HTML, markdown, navigation elements, and boilerplate
 */
function cleanText(text: string): string {
  if (!text) return ''
  
  let cleaned = text
  
  // Step 1: Remove all markdown syntax
  // Remove markdown images: ![alt](url) or ![alt]
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]*\)/g, ' ')
  cleaned = cleaned.replace(/!\[([^\]]*)\]/g, ' ')
  
  // Remove markdown links: [text](url) but keep the text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  
  // Remove markdown headers: # Header, ## Header, etc.
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, ' ')
  
  // Remove markdown bold/italic: **text**, *text*, __text__, _text_
  cleaned = cleaned.replace(/\*\*([^\*]+)\*\*/g, '$1')
  cleaned = cleaned.replace(/\*([^\*]+)\*/g, '$1')
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1')
  
  // Remove markdown code blocks: `code` or ```code```
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' ')
  cleaned = cleaned.replace(/`[^`]+`/g, ' ')
  
  // Remove markdown lists: - item, * item, 1. item
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, ' ')
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, ' ')
  
  // Remove markdown horizontal rules
  cleaned = cleaned.replace(/^[-*_]{3,}$/gm, ' ')
  
  // Step 2: Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')
  
  // Step 3: Remove URLs (http://, https://, www.)
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ' ')
  cleaned = cleaned.replace(/www\.[^\s]+/g, ' ')
  
  // Step 4: Remove common navigation/boilerplate patterns
  // Be more selective - only remove obvious navigation, not content that might be useful
  const boilerplatePatterns = [
    /Skip to main content/gi,
    /Skip to content/gi,
    /Official websites use \.gov/gi,
    /Secure \.gov websites use HTTPS/gi,
    /A \.gov website belongs to an official government organization in the United States/gi,
    /A lock.*means you've safely connected/gi,
    /A lock.*or https.*means you've safely connected/gi,
    /LockLocked padlock/gi,
    /Lock.*padlock.*means/gi,
    /You can also call.*for current highway conditions/gi,
    /You can also call 1-800-427-7623/gi,
    /Image of.*?\./gi,
    /Icon.*?\./gi,
    /Dot gov/gi,
    /Https/gi,
    /means you've safely connected/gi,
    /safely connected to the/gi,
    /belongs to an official government organization in the United States/gi,
    /Share sensitive information only on official, secure websites/gi,
    /Share sensitive information only on official/gi,
    /No Featured Alerts at this Time/gi,
    /Creative Conservation for Endangered Frogs/gi,
    /View All Features/gi,
    /USDA in the News/gi,
  ]
  
  // Don't remove these as they might be actual content:
  // - "Know before you go" (could be a real advisory)
  // - "National Weather Service" (could be part of content)
  // - "Check Current Highway Conditions" (could be actual instruction)
  // - "Enter Highway Number" (could be part of a form description that's useful)
  
  for (const pattern of boilerplatePatterns) {
    cleaned = cleaned.replace(pattern, ' ')
  }
  
  // Step 5: Remove standalone punctuation and symbols
  cleaned = cleaned.replace(/^[^\w\s]+$/gm, ' ')
  
  // Step 6: Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

/**
 * Extract meaningful content blocks (paragraphs or sections)
 */
function extractContentBlocks(text: string): string[] {
  if (!text || text.length < 20) return []
  
  // First, try to extract content by markdown headers (these often indicate sections)
  const headerSections: string[] = []
  const headerRegex = /#{1,6}\s+([^\n]+)\n([\s\S]*?)(?=#{1,6}|$)/g
  let match
  while ((match = headerRegex.exec(text)) !== null) {
    const header = match[1].trim()
    const content = match[2].trim()
    // Look for important headers like "Alerts", "Fire Danger", etc.
    if (/alert|fire|danger|restriction|status|condition/i.test(header) && content.length > 20) {
      headerSections.push(`${header}: ${content}`)
    }
  }
  
  // If we found good header sections, use those
  if (headerSections.length > 0) {
    return headerSections
  }
  
  // Otherwise, split by sentence boundaries, double newlines, or common separators
  const blocks = text
    .split(/[.!?]\s+|\.\s+|\n\s*\n/)
    .map(block => block.trim())
    .filter(block => {
      // Filter out very short blocks
      if (block.length < 20) return false
      
      // Filter out blocks that are mostly boilerplate
      // Be more lenient - only filter if it's clearly just boilerplate
      const strictBoilerplateWords = [
        'skip to main content',
        'official websites use .gov',
        'secure .gov websites',
        'a .gov website belongs to',
        'lock.*padlock.*means',
        'you can also call 1-800',
        'image of',
        'icon',
        'dot gov',
        'https.*means'
      ]
      const lowerBlock = block.toLowerCase()
      const isStrictBoilerplate = strictBoilerplateWords.some(phrase => {
        const regex = new RegExp(phrase.replace(/\*/g, '.*'), 'i')
        return regex.test(lowerBlock)
      })
      
      // Only filter if it's clearly just boilerplate with no other content
      if (isStrictBoilerplate && block.length < 100) {
        return false
      }
      
      // Filter out blocks that are mostly numbers or symbols
      const alphaChars = (block.match(/[a-zA-Z]/g) || []).length
      if (alphaChars < block.length * 0.3) return false
      
      // Filter out blocks that are just lists of forest names (common pattern)
      const forestNamePattern = /[A-Z][a-z]+\s+National\s+Forest/gi
      const forestMatches = (block.match(forestNamePattern) || []).length
      // If more than 2 forest names and block is relatively short, it's likely a list
      if (forestMatches > 2 && block.length < 500) {
        // But keep it if it also has status keywords
        const hasStatusKeywords = /fire|alert|danger|restriction|closed|open/i.test(block)
        if (!hasStatusKeywords) {
          return false
        }
      }
      
      return true
    })
  
  return blocks
}

/**
 * Generate a more detailed summary from the raw text
 * Extracts key sentences or phrases that indicate status
 */
export function generateDetailedSummary(rawText: string, maxLength: number = 250): string {
  if (!rawText || !rawText.trim()) {
    return 'No content available.'
  }

  // FIRST: Check for QuickMap-specific road condition indicators in raw text
  // QuickMap is a dynamic app, so we need to extract indicators from the static HTML
  const quickMapIndicators: string[] = []
  const quickMapPatterns = [
    /Lane\s+Closures?/gi,
    /Full\s+Closure/gi,
    /Chain\s+Control/gi,
    /Chains\s+Required/gi,
    /Road\s+Closed/gi,
    /Construction/gi,
    /Accident/gi,
    /Incident/gi,
    /Delay/gi,
    /Restricted/gi,
    // Skip UI elements like "Road Conditions: Fast", "Traffic Scale", etc. as they're not actual conditions
  ]
  
  for (const pattern of quickMapPatterns) {
    const matches = rawText.match(pattern)
    if (matches) {
      quickMapIndicators.push(...matches)
    }
  }
  
  // If we found QuickMap indicators, create a summary from them
  if (quickMapIndicators.length > 0) {
    const cleanIndicators = quickMapIndicators
      .map(ind => ind.replace(/[!*]/g, '').trim())
      .filter(ind => ind.length > 0)
      .filter((ind, idx, arr) => arr.indexOf(ind) === idx) // Remove duplicates
    
    if (cleanIndicators.length > 0) {
      // Categorize indicators for clearer messaging
      const closures = cleanIndicators.filter(ind => 
        /closure|closed/i.test(ind)
      )
      const restrictions = cleanIndicators.filter(ind => 
        /chain|restricted/i.test(ind)
      )
      const delays = cleanIndicators.filter(ind => 
        /construction|accident|incident|delay/i.test(ind)
      )
      
      let summary = ''
      if (closures.length > 0) {
        summary = `Road closures detected: ${closures.join(', ')}. `
      }
      if (restrictions.length > 0) {
        summary += `Road restrictions: ${restrictions.join(', ')}. `
      }
      if (delays.length > 0) {
        summary += `Road conditions may cause delays: ${delays.join(', ')}. `
      }
      
      // If we didn't categorize anything, use the original format
      if (!summary) {
        summary = `Road conditions detected: ${cleanIndicators.join(', ')}. `
      }
      
      return summary + 'Check QuickMap for specific locations and details.'
    }
  }

  // First, try to extract content from markdown headers before cleaning
  // This preserves structure that might be lost during cleaning
  const headerSections: string[] = []
  const headerRegex = /#{1,6}\s+([^\n]+)\n([\s\S]*?)(?=#{1,6}|$)/g
  let match
  while ((match = headerRegex.exec(rawText)) !== null) {
    const header = match[1].trim()
    let content = match[2].trim()
    
    // If header says "No Featured Alerts", skip it entirely
    if (/no\s+featured\s+alerts/i.test(header)) {
      continue
    }
    
    // If content contains "No Featured Alerts", stop extracting at that point
    const noAlertsIndex = content.search(/no\s+featured\s+alerts/i)
    if (noAlertsIndex > 0) {
      content = content.substring(0, noAlertsIndex).trim()
    }
    
    // Skip featured article content immediately
    const featuredContentPattern = /(creative\s+conservation|featured\s+article|usda\s+in\s+the\s+news|endangered\s+species|zoos|coolers|invests.*million|usda\s+invests|conserving\s+endangered|sierra\s+nevada\s+yellow-legged|requires\s+a\s+bit\s+of\s+creativity|beautiful\s+landscape\s+awaits|a\s+beautiful\s+landscape|top\s+tip|release\s+date|labor\s+day|help\s+prevent|human-caused|wildfire\s+prevention)/i
    if (featuredContentPattern.test(content) || featuredContentPattern.test(header)) {
      continue // Skip this header section entirely
    }
    
    // Look for important headers like "Alerts", "Fire Danger", etc.
    if (/alert|fire|danger|restriction|status|condition/i.test(header) && content.length > 20) {
      // Extract text from markdown links: [text](url) -> text
      // Add spaces between markdown links to preserve structure
      let cleanedContent = content
        .replace(/\]\([^\)]+\)\s*\[/g, '] [') // Add space between consecutive links
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Extract text from links
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
      
      // Double-check for featured content after cleaning
      if (featuredContentPattern.test(cleanedContent)) {
        continue // Skip this header section
      }
      
      // If cleaned content is empty or too short after filtering, skip
      if (cleanedContent.length < 20) {
        continue
      }
      
      headerSections.push(`${header}: ${cleanedContent}`)
    }
  }
  
  // If we found good header sections, use those (but still clean them)
  if (headerSections.length > 0) {
    const combined = headerSections.join(' ')
    
    // Check for featured content in combined header sections BEFORE cleaning
    const featuredContentPattern = /(creative\s+conservation|featured\s+article|usda\s+in\s+the\s+news|endangered\s+species|zoos|coolers|invests.*million|usda\s+invests|conserving\s+endangered|sierra\s+nevada\s+yellow-legged|requires\s+a\s+bit\s+of\s+creativity|usda\s+invests\s+just\s+over|top\s+tip|release\s+date|labor\s+day|help\s+prevent|human-caused|wildfire\s+prevention)/i
    if (featuredContentPattern.test(combined)) {
      // This is featured content, not real alerts - return early
      return 'No active alerts or restrictions at this time.'
    }
    
    let cleaned = cleanText(combined)
    
    // Apply formatting fixes
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2')
    cleaned = cleaned.replace(/::+/g, ':')
    cleaned = cleaned.replace(/\s*🡪\s*/g, ' ')
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    
    // Format alerts and fire danger status better
    // First, extract and remove Fire Danger Status separately
    let fireDangerStatus: string = ''
    cleaned = cleaned.replace(/\s*Fire\s+Danger\s+Status:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[A-Z][a-z]+\s+National\s+Forest\s*$/gi, (match: string, status: string) => {
      fireDangerStatus = `Fire Danger Status: ${status}`
      return '' // Remove from main text
    })
    // Also catch Fire Danger Status without the forest name
    cleaned = cleaned.replace(/\s*Fire\s+Danger\s+Status:\s*([A-Z][a-z]+)\s*$/gi, (match: string, status: string) => {
      if (!fireDangerStatus) {
        fireDangerStatus = `Fire Danger Status: ${status}`
      }
      return '' // Remove from main text
    })
    
    // Now format alerts
    cleaned = cleaned.replace(/Alerts:\s*([^.]*?)(?:\s*Fire\s+Danger\s+Status|$)/gi, (match: string, alerts: string) => {
      // Remove "View All Alerts" 
      let cleanAlerts = alerts.replace(/View\s+All\s+Alerts/gi, '').trim()
      
      // Split alerts by fire names and restrictions
      const alertParts: string[] = []
      
      // Pattern 1: Look for "Fire Restrictions for [Location]"
      // Match the full pattern including the location (which may contain multiple words)
      // The location can be multiple words, so we need to be careful with the lookahead
      const restrictionPattern = /Fire\s+Restrictions?\s+for\s+((?:the\s+)?[A-Z][A-Za-z\s]+?)(?=\s+(?:Fire\s+Restrictions|Gifford|Madre|Fire\s+Danger|$|[A-Z][a-z]+\s+Fire))/gi
      let restrictionMatch
      const foundRestrictions: string[] = []
      while ((restrictionMatch = restrictionPattern.exec(cleanAlerts)) !== null) {
        const location = restrictionMatch[1].trim()
        // Filter out locations that are too short or are actually fire names
        if (location.length > 5 && location.length < 100 && !location.match(/^(the\s+)?Los\s+Padres\s+National\s+Forest$/i)) {
          const restriction = `Fire Restrictions: ${location}`
          if (!foundRestrictions.includes(restriction)) {
            foundRestrictions.push(restriction)
            alertParts.push(restriction)
          }
        }
      }
      
      // Pattern 2: Look for named fires (Gifford Fire, Madre Fire, etc.)
      // Be more specific - only match proper fire names, not words that happen to end with "Fire"
      const namedFirePattern = /\b(Gifford|Madre|Creek|Bear|Pine|Squirrel|Eagle|Thunder|Lightning|Wild|Canyon|Mountain|Peak|Ridge|Valley|Summit)\s+Fire\b/gi
      let namedMatch
      const foundFires: string[] = []
      while ((namedMatch = namedFirePattern.exec(cleanAlerts)) !== null) {
        const fireName = namedMatch[0].trim()
        if (fireName.length > 0 && !foundFires.includes(fireName)) {
          foundFires.push(fireName)
          alertParts.push(fireName)
        }
      }
      
      // If we still don't have enough, try a more general pattern but be careful
      if (alertParts.length === 0) {
        const generalFirePattern = /\b([A-Z][a-z]{3,}\s+Fire)\b/gi
        let generalMatch
        while ((generalMatch = generalFirePattern.exec(cleanAlerts)) !== null) {
          const fireName = generalMatch[1].trim()
          // Skip if it's part of "Fire Restrictions"
          if (!fireName.match(/Restrictions/i) && !foundFires.includes(fireName)) {
            foundFires.push(fireName)
            alertParts.push(fireName)
          }
        }
      }
      
      // If we didn't find matches, try splitting by "Fire" keyword
      if (alertParts.length === 0) {
        const parts = cleanAlerts.split(/(?=\bFire\b)/i)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0 && !p.match(/^View\s+All\s+Alerts$/i))
          .map((p: string) => {
            const cleaned = p.replace(/^Fire\s+Restrictions?\s+for\s+/i, 'Fire Restrictions: ')
            return cleaned.trim()
          })
          .filter((p: string) => p.length > 0)
        alertParts.push(...parts)
      }
      
      if (alertParts.length > 0) {
        return `Alerts: ${alertParts.join(', ')}`
      }
      return match
    })
    
    // Remove duplicate "Los Padres National Forest" at the end if it appears
    cleaned = cleaned.replace(/\s+Los\s+Padres\s+National\s+Forest\s*$/i, '')
    cleaned = cleaned.replace(/\s+Los\s+Padr\s*$/i, '') // Handle truncation
    cleaned = cleaned.trim()
    
    // Add Fire Danger Status at the end if we extracted it
    if (fireDangerStatus && cleaned.length > 0) {
      cleaned = `${cleaned}. ${fireDangerStatus}`
    } else if (fireDangerStatus) {
      cleaned = fireDangerStatus
    }
    
    // Clean up any remaining issues
    cleaned = cleaned.replace(/\s*\.\s*\./g, '.')
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    
    if (cleaned.length > 20) {
      // Truncate if needed
      if (cleaned.length > maxLength) {
        const truncated = cleaned.substring(0, maxLength)
        const lastPeriod = truncated.lastIndexOf('.')
        if (lastPeriod > maxLength * 0.6) {
          return truncated.substring(0, lastPeriod + 1)
        }
        return truncated.trim() + '...'
      }
      return cleaned
    }
  }

  // Clean the text first (removes markdown, HTML, boilerplate)
  const cleanedText = cleanText(rawText)
  
  // Check for "No Featured Alerts" or similar messages that indicate no active alerts
  const lowerText = cleanedText.toLowerCase()
  const lowerRawText = rawText.toLowerCase()
  
  // Check if content is mostly featured articles, news, or educational content
  // This should be checked FIRST, before trying to extract alerts
  const featuredContentPattern = /(creative\s+conservation|featured\s+article|usda\s+in\s+the\s+news|view\s+all\s+features|endangered\s+species|zoos|coolers|invests.*million|usda\s+invests|conserving\s+endangered|sierra\s+nevada\s+yellow-legged|requires\s+a\s+bit\s+of\s+creativity|usda\s+invests\s+just\s+over|top\s+tip|release\s+date|labor\s+day|help\s+prevent|human-caused|wildfire\s+prevention)/i
  const isMostlyFeatured = featuredContentPattern.test(cleanedText) || 
                           featuredContentPattern.test(rawText) ||
                           cleanedText.match(/conserving\s+endangered\s+species/i) ||
                           cleanedText.match(/sierra\s+nevada\s+yellow-legged\s+frog/i) ||
                           cleanedText.match(/usda\s+invests\s+just\s+over/i)
  
  // Check if the page is primarily showing "no alerts" with featured articles
  const hasNoAlertsMessage = lowerText.includes('no featured alerts') || 
                             lowerText.includes('no active alerts') || 
                             lowerText.includes('no current alerts') ||
                             lowerRawText.includes('no featured alerts') ||
                             lowerRawText.includes('no featured alerts at this time')
  
  if (hasNoAlertsMessage || isMostlyFeatured) {
    // Look for actual alert content beyond the "no featured alerts" message
    // Check for real alerts (not just featured articles or news)
    const realAlertPattern = /(fire\s+danger\s+status|fire\s+restriction|area\s+closed|trail\s+closed|road\s+closed|closure|restricted|warning|advisory|evacuation)/i
    const hasRealAlerts = realAlertPattern.test(cleanedText) && 
                         !cleanedText.match(/no\s+(featured|active|current)\s+alerts/i) &&
                         // Make sure it's not just part of a featured article
                         !isMostlyFeatured
    
    // If we have featured content and no real alerts, return early with a clear message
    if (!hasRealAlerts && isMostlyFeatured) {
      // This is likely just a "no alerts" page with featured content
      return 'No active alerts or restrictions at this time.'
    }
  }
  
  // Check for error pages (404, not found, etc.)
  // But be careful - "404" might be part of actual content (like "Route 404" or "High 404")
  const errorIndicators = [
    /404\s+page\s+not\s+found/i,
    /page\s+not\s+found/i,
    /404\s+error/i,
    /the\s+page\s+you\s+are\s+looking\s+for/i,
    /could\s+not\s+be\s+found/i
  ]
  
  // Only flag as 404 if it's clearly an error message, not just the number "404"
  const isErrorPage = errorIndicators.some(pattern => pattern.test(cleanedText))
  if (isErrorPage && cleanedText.length < 200) {
    // Only treat as 404 if the page is very short (likely an error page)
    return 'Source page not found (404). The URL may have changed or the page may be temporarily unavailable.'
  }
  
  // Before giving up, check if there are any road condition keywords in the raw text
  // This helps with QuickMap content that might be hard to parse
  const roadConditionKeywords = /(lane\s+closure|full\s+closure|chain\s+control|chains\s+required|construction|accident|incident|delay|traffic|road\s+closed|restricted|open|closed)/i
  const hasRoadKeywords = roadConditionKeywords.test(rawText) || roadConditionKeywords.test(cleanedText)
  
  if (!cleanedText || cleanedText.length < 20) {
    // If we have road keywords but can't parse, try to extract them directly
    if (hasRoadKeywords) {
      const conditions: string[] = []
      if (/lane\s+closure/i.test(rawText)) conditions.push('lane closures')
      if (/full\s+closure/i.test(rawText)) conditions.push('full closures')
      if (/chain\s+control|chains\s+required/i.test(rawText)) conditions.push('chain requirements')
      if (/construction/i.test(rawText)) conditions.push('construction')
      if (/accident|incident/i.test(rawText)) conditions.push('incidents')
      if (/road\s+closed/i.test(rawText)) conditions.push('road closures')
      
      if (conditions.length > 0) {
        return `Road conditions detected: ${conditions.join(', ')}. Check QuickMap for specific locations and details.`
      }
    }
    return 'Content available but could not be parsed. Please check source for details.'
  }

  // Extract content blocks (sentences/paragraphs)
  const contentBlocks = extractContentBlocks(cleanedText)
  
  // If no blocks found, try a more lenient extraction
  if (contentBlocks.length === 0) {
    // Before giving up, check for road keywords
    if (hasRoadKeywords) {
      const conditions: string[] = []
      if (/lane\s+closure/i.test(rawText)) conditions.push('lane closures')
      if (/full\s+closure/i.test(rawText)) conditions.push('full closures')
      if (/chain\s+control|chains\s+required/i.test(rawText)) conditions.push('chain requirements')
      if (/construction/i.test(rawText)) conditions.push('construction')
      if (/accident|incident/i.test(rawText)) conditions.push('incidents')
      if (/road\s+closed/i.test(rawText)) conditions.push('road closures')
      
      if (conditions.length > 0) {
        return `Road conditions detected: ${conditions.join(', ')}. Check QuickMap for specific locations and details.`
      }
    }
    // Try splitting by sentences with a lower threshold
    const sentences = cleanedText
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(s => {
        if (s.length < 15 || s.length > 500) return false
        const alphaChars = (s.match(/[a-zA-Z]/g) || []).length
        if (alphaChars < s.length * 0.2) return false
        // Be more lenient with boilerplate filtering
        const lower = s.toLowerCase()
        const strictBoilerplate = ['skip to main content', 'official websites use', 'secure .gov websites']
        return !strictBoilerplate.some(phrase => lower.includes(phrase))
      })
      .slice(0, 3)
    
    if (sentences.length > 0) {
      let fallbackSummary = sentences.join('. ').trim()
      if (!fallbackSummary.match(/[.!?]$/)) {
        fallbackSummary += '.'
      }
      // Truncate if needed
      if (fallbackSummary.length > maxLength) {
        const truncated = fallbackSummary.substring(0, maxLength)
        const lastPeriod = truncated.lastIndexOf('.')
        if (lastPeriod > maxLength * 0.6) {
          return truncated.substring(0, lastPeriod + 1)
        }
        return truncated + '...'
      }
      return fallbackSummary
    }
    
    return 'Content available but could not be parsed. Please check source for details.'
  }

  // Find blocks with status keywords (prioritize these)
  // Use weighted keywords - some are more important than others
  const highPriorityKeywords = [
    'fire danger', 'fire restriction', 'fire status', 'alert', 'warning',
    'closed', 'open', 'restricted', 'closure', 'lane closure', 'full closure',
    'chain control', 'chains required', 'traffic', 'construction', 'accident'
  ]
  const mediumPriorityKeywords = [
    'chains', 'permit', 'access', 'notice', 'condition', 'status',
    'advisory', 'update', 'current', 'required', 'prohibited',
    'road conditions', 'highway conditions', 'travel alert', 'incident', 'delay'
  ]
  const lowPriorityKeywords = [
    'road', 'trail', 'campground', 'snow', 'weather', 'information', 
    'highway', 'route', 'danger', 'restriction', 'high', 'moderate', 'low'
  ]
  
  // Score blocks by keyword importance
  const scoredBlocks = contentBlocks.map(block => {
    const lowerBlock = block.toLowerCase()
    let score = 0
    
    // Heavily penalize blocks with featured article/news content
    const featuredArticleKeywords = [
      'creative conservation', 'featured article', 'usda in the news',
      'endangered species', 'zoos', 'coolers', 'invests', 'million',
      'conserving endangered', 'sierra nevada yellow-legged', 'requires a bit of creativity',
      'usda invests just over', 'usda invests'
    ]
    const hasFeaturedContent = featuredArticleKeywords.some(keyword => lowerBlock.includes(keyword))
    if (hasFeaturedContent) {
      score -= 100 // Heavy penalty to exclude these blocks
    }
    
    highPriorityKeywords.forEach(keyword => {
      if (lowerBlock.includes(keyword)) score += 10
    })
    mediumPriorityKeywords.forEach(keyword => {
      if (lowerBlock.includes(keyword)) score += 5
    })
    lowPriorityKeywords.forEach(keyword => {
      if (lowerBlock.includes(keyword)) score += 1
    })
    
    // Penalize blocks that are just lists of names
    if (/^[A-Z][a-z]+\s+National\s+Forest/i.test(block) && block.length < 100) {
      score -= 5
    }
    
    // Heavily penalize QuickMap navigation/boilerplate
    if (lowerBlock.includes('know before you go') && lowerBlock.includes('national weather service') && lowerBlock.includes('caltrans social media')) {
      score -= 50 // Much heavier penalty
    }
    if (lowerBlock.includes('travel alert') && lowerBlock.includes('know before you go')) {
      score -= 30
    }
    if (lowerBlock.includes('winter driving tips')) {
      score -= 20
    }
    if (lowerBlock.includes('traffic scale') || lowerBlock.includes('traffic cone') || lowerBlock.includes('pending lcs')) {
      score -= 15 // These are UI elements, not actual conditions
    }
    
    // Boost blocks with actual road condition indicators
    if (lowerBlock.includes('lane closure') || lowerBlock.includes('full closure') || lowerBlock.includes('chain control')) {
      score += 15
    }
    if (lowerBlock.includes('traffic') && (lowerBlock.includes('slow') || lowerBlock.includes('fast') || lowerBlock.includes('delay'))) {
      score += 10
    }
    if (lowerBlock.includes('construction') || lowerBlock.includes('accident') || lowerBlock.includes('incident')) {
      score += 12
    }
    
    return { block, score }
  })
  
  // Sort by score and take top blocks
  const relevantBlocks = scoredBlocks
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.block)

  // Use relevant blocks if found, otherwise use first few blocks
  // Be more lenient - if we have any content blocks, use them even without keywords
  // But prioritize blocks with status keywords
  let blocksToUse: string[]
  if (relevantBlocks.length > 0) {
    // Use the scored blocks (already sorted by importance)
    blocksToUse = relevantBlocks.slice(0, 3)
  } else {
    // If no relevant blocks, use first few blocks that look like content
    // Filter out blocks that are just lists of forest names
    blocksToUse = contentBlocks
      .filter(block => {
        // Filter out blocks that are clearly navigation/boilerplate
        const lower = block.toLowerCase()
        const strictBoilerplate = [
          'skip to main content',
          'official websites use',
          'secure .gov websites',
          'click here',
          'learn more',
          'view all',
          'enter highway number',
          'know before you go',
          'national weather service',
          'caltrans social media',
          'road information',
          'winter driving tips',
          'travel alert',
          'traffic scale',
          'traffic cone',
          'pending lcs',
          'full closure sign'
        ]
        if (strictBoilerplate.some(phrase => lower.includes(phrase))) {
          return false
        }
        // Filter out blocks that are just lists of forest names
        if (/^[A-Z][a-z]+\s+National\s+Forest/i.test(block.trim()) && block.length < 150) {
          return false
        }
        // Filter out blocks that are mostly just forest names
        const forestNameMatches = (block.match(/National\s+Forest/gi) || []).length
        if (forestNameMatches > 2 && block.length < 300) {
          return false
        }
        return true
      })
      .slice(0, 3)
  }
  
  // Take first 2-3 blocks and join them
  let summary = blocksToUse
    .slice(0, 3)
    .filter(block => {
      // Additional filtering: remove blocks that are too generic or too short
      const lowerBlock = block.toLowerCase()
      if (lowerBlock.includes('click here') || lowerBlock.includes('learn more')) {
        return false
      }
      // Filter out blocks that are mostly numbers or symbols
      const alphaChars = (block.match(/[a-zA-Z]/g) || []).length
      if (alphaChars < block.length * 0.3) {
        return false
      }
      // Filter out very short blocks
      if (block.trim().length < 15) {
        return false
      }
      // Filter out blocks that end with incomplete text like "404 Page Not Fou"
      if (/404\s+Page\s+Not\s+Fou/i.test(block)) {
        return false
      }
      return true
    })
    .map(block => {
      // Clean up the block
      let sentence = block.trim()
      // Remove trailing ellipses or incomplete sentences
      sentence = sentence.replace(/\.\.\.*$/, '')
      // Remove incomplete "404 Page Not Fou" references
      sentence = sentence.replace(/\s*404\s+Page\s+Not\s+Fou.*$/i, '')
      // Fix spacing issues (e.g., "HighLos" -> "High Los")
      sentence = sentence.replace(/([a-z])([A-Z])/g, '$1 $2')
      // Ensure sentences end properly
      if (sentence.length > 0 && !sentence.match(/[.!?]$/)) {
        sentence += '.'
      }
      return sentence
    })
    .filter(s => s.length > 0)
    .join(' ')
    .trim()

  // Final cleanup - remove QuickMap boilerplate that might have slipped through
  summary = summary
    .replace(/Travel\s+Alert:\s*Know\s+before\s+you\s+go[^.]*?Road\s+Information[^.]*?/gi, '')
    .replace(/National\s+Weather\s+Service\s*-\s*Caltrans\s+Social\s+Media\s*-\s*Road\s+Information/gi, '')
    .replace(/1-800-427-7623/gi, '')
    .replace(/Winter\s+Driving\s+Tips/gi, '')
    .replace(/QuickMap\s+Mobile/gi, '')
    .replace(/QuickMap\s+FAQ/gi, '')
    .replace(/Caltrans\s+QuickMap[^.]*?Traveler\s+Information\s+Map/gi, '')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\.\s*\./g, '.') // Remove double periods
    .replace(/\.\s*\.\s*\./g, '...') // Keep triple dots as ellipsis
    .replace(/^\s*[.,;:]\s*/g, '') // Remove leading punctuation
    .replace(/\s+([.,;:])/g, '$1') // Remove space before punctuation
    .trim()
  
  // Check if summary is mostly navigation/instructions (not actual status)
  const lowerSummary = summary.toLowerCase()
  const navigationPhrases = [
    'enter highway number',
    'check current highway conditions',
    'know before you go',
    'you can also call',
    'road information',
    'national weather service',
    'caltrans social media',
    'quickmap real-time travel information'
  ]
  const navigationCount = navigationPhrases.filter(phrase => lowerSummary.includes(phrase)).length
  
  // If it's mostly navigation, try to extract any actual information first
  if (navigationCount >= 2 && summary.length < 200) {
    // Look for any actual status information in the raw text (before cleaning)
    const statusPatterns = [
      /(closed|open|restricted|chains required|snow|ice|flood|construction)/i,
      /(highway|route|road)\s+\d+/i,
      /(condition|status|advisory|warning)/i
    ]
    
    const hasStatusInfo = statusPatterns.some(pattern => pattern.test(rawText))
    
    if (!hasStatusInfo) {
      // No actual status found - this is a navigation/form page
      // Provide actionable information instead of generic message
      return 'This is a general road information page. For current road conditions in this area, visit QuickMap (quickmap.dot.ca.gov) or call 1-800-427-7623. You can also check the source link for specific highway conditions.'
    }
  }
  
  // If summary is still empty or too short, try a different approach
  if (summary.length < 20) {
    // Fallback: take first meaningful sentences from cleaned text
    const sentences = cleanedText
      .split(/[.!?]\s+/)
      .filter(s => {
        const trimmed = s.trim()
        if (trimmed.length < 20 || trimmed.length > 300) return false
        // Skip sentences that are mostly boilerplate
        const lower = trimmed.toLowerCase()
        const boilerplateWords = ['skip', 'main content', 'official website', 'secure', 'lock', 'https', 'dot gov', 'click here', 'learn more']
        return !boilerplateWords.some(word => lower.includes(word))
      })
      .slice(0, 2)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    if (sentences.length > 0) {
      summary = sentences.join('. ').trim()
      if (!summary.match(/[.!?]$/)) {
        summary += '.'
      }
    }
  }
  
  if (summary.length < 20) {
    return 'Content available but could not be parsed. Please check source for details.'
  }

  // Remove any trailing "404 Page Not Fou..." or similar incomplete text
  summary = summary.replace(/\s*404\s+Page\s+Not\s+Fou.*$/i, '')
  summary = summary.replace(/\s*Page\s+Not\s+Fou.*$/i, '')
  
  // Fix spacing issues (e.g., "HighLos" -> "High Los", "Alerts::" -> "Alerts:")
  summary = summary.replace(/([a-z])([A-Z])/g, '$1 $2')
  summary = summary.replace(/::+/g, ':')
  summary = summary.replace(/([A-Z][a-z]+)([A-Z][a-z]+)/g, '$1 $2') // Fix cases like "HighLos"
  
  // Clean up multiple spaces and normalize
  summary = summary.replace(/\s+/g, ' ').trim()
  
  // Fix common patterns
  summary = summary.replace(/\s*🡪\s*/g, ' ') // Remove arrow symbols
  summary = summary.replace(/\s+/g, ' ').trim() // Clean up again
  
  // Truncate if needed
  if (summary.length > maxLength) {
    // Try to truncate at a sentence boundary
    const truncated = summary.substring(0, maxLength)
    const lastPeriod = truncated.lastIndexOf('.')
    const lastExclamation = truncated.lastIndexOf('!')
    const lastQuestion = truncated.lastIndexOf('?')
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)
    
    if (lastSentenceEnd > maxLength * 0.6) {
      return truncated.substring(0, lastSentenceEnd + 1)
    }
    // Try to truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...'
    }
    return truncated.trim() + '...'
  }

  return summary
}


