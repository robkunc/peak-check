# Phase 4: Firecrawl Integration (Land Manager & Road Status) - Summary

## Overview
Phase 4 implements web scraping integration using Firecrawl to fetch and parse land manager and road status information for peaks.

## Implementation Details

### 1. Firecrawl Client (`src/lib/firecrawl-client.ts`)
- Integrated `@mendable/firecrawl-js` package
- Created `scrapeUrl()` function to extract main content from URLs
- Returns markdown and raw text for parsing
- Gracefully handles missing API key configuration

### 2. Status Parser (`src/lib/status-parser.ts`)
- Implements keyword-based status inference
- Maps text to status codes: `open`, `closed`, `restricted`, `chains_required`, `unknown`
- Generates detailed summaries from scraped content
- Extracts relevant sentences containing status keywords

### 3. Background Jobs

#### Land Manager Status Job (`src/app/api/jobs/refresh-land-status/route.ts`)
- Scrapes all peaks with `LAND_MANAGER` sources
- Stores snapshots in `land_status_snapshots` table
- Protected by `CRON_SECRET` environment variable
- Processes peaks sequentially to avoid rate limiting

#### Road Status Job (`src/app/api/jobs/refresh-road-status/route.ts`)
- Scrapes all peaks with `ROAD_STATUS` sources
- Stores snapshots in `road_status_snapshots` table
- Protected by `CRON_SECRET` environment variable
- Processes peaks sequentially to avoid rate limiting

### 4. UI Integration
- Conditions page already displays land status and road status sections
- Shows status codes with color-coded badges
- Displays summaries and "View source" links
- Shows last updated timestamps

## Environment Variables Required

```bash
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
CRON_SECRET=your_cron_secret_here  # Optional, for protecting job endpoints
```

## API Endpoints

- `POST /api/jobs/refresh-land-status` - Refresh land manager status for all peaks
- `POST /api/jobs/refresh-road-status` - Refresh road status for all peaks

Both endpoints:
- Require `Authorization: Bearer {CRON_SECRET}` header if `CRON_SECRET` is set
- Return JSON with success status and results summary

## Next Steps

1. **Configure Firecrawl API Key**: Add `FIRECRAWL_API_KEY` to `.env.local`
2. **Add Sources**: Use admin interface (Phase 5) to add land manager and road status URLs to peaks
3. **Set Up Cron Jobs**: Configure Vercel cron jobs or external scheduler to call refresh endpoints
4. **Test**: Manually trigger jobs or wait for scheduled runs to populate data

## Status Parsing Logic

The parser looks for these keywords in order of priority:
1. **Closed**: "closed", "closure", "temporarily closed", "permanently closed"
2. **Chains Required**: "chains required", "chain control", "snow chains"
3. **Restricted**: "restricted", "limited access", "permit required"
4. **Open**: "open", "accessible", "available"
5. **Unknown**: Default if no keywords found

## Notes

- Firecrawl extracts main content and returns markdown/HTML
- Raw text is limited to 10,000 characters in database
- Status summaries are limited to 500 characters by default
- Jobs include 1-second delays between requests to respect rate limits

