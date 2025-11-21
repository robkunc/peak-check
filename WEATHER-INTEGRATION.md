# Weather Integration (Phase 3)

## Overview

The application integrates with the **NOAA National Weather Service API** (api.weather.gov) to fetch current conditions and forecasts for peaks based on their GPS coordinates.

## How It Works

1. **Grid Point Lookup**: For each peak's GPS coordinates, the system first gets a "grid point" from NOAA
2. **Forecast Fetch**: Uses the grid point to fetch the 7-day forecast
3. **Current Conditions**: Attempts to fetch current hourly conditions
4. **Summary Generation**: Creates a human-readable summary from the data
5. **Storage**: Saves the data as a `WeatherSnapshot` in the database

## API Endpoints

### Background Job

**POST `/api/jobs/refresh-weather`**

Refreshes weather data for all active peaks with GPS coordinates.

**Authentication:**
- Protected by `CRON_SECRET` environment variable
- Send as: `Authorization: Bearer <CRON_SECRET>`

**Response:**
```json
{
  "success": true,
  "results": {
    "total": 6,
    "successful": 6,
    "failed": 0,
    "errors": []
  },
  "timestamp": "2025-01-27T..."
}
```

**Manual Testing:**
```bash
curl -X POST http://localhost:3001/api/jobs/refresh-weather \
  -H "Authorization: Bearer your-cron-secret"
```

## Configuration

### Environment Variables

No API key required! The NOAA API is free and public.

However, you should set:
- `CRON_SECRET` - Secret token to protect the job endpoint

### Cron Schedule

Configured in `vercel.json`:
- Runs every 3 hours: `0 */3 * * *`

For local development, you can trigger manually or set up a local cron.

## Data Structure

### WeatherSnapshot Model

```typescript
{
  id: string
  peakId: string
  source: "NOAA"
  rawJson: {
    gridPoint: { gridId, gridX, gridY }
    current: { temperature, conditions, windSpeed, ... }
    forecast: [ /* 7 forecast periods */ ]
  }
  summaryText: string // Human-readable summary
  fetchedAt: DateTime
}
```

## Testing

### Test the API Client

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-weather-api.ts
```

### Test the Background Job

1. Make sure you have peaks with GPS coordinates in the database
2. Set `CRON_SECRET` in your `.env.local`
3. Call the endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/jobs/refresh-weather \
     -H "Authorization: Bearer your-cron-secret"
   ```

### View Weather Data

1. Run the refresh job (or wait for cron)
2. Visit a peak page (e.g., `/peaks/mount-baldy`)
3. Weather section should display current conditions and forecast

## Error Handling

- If a peak doesn't have GPS coordinates, it's skipped
- If NOAA API fails for a peak, it's logged but doesn't stop other peaks
- Rate limiting: 500ms delay between peaks to avoid hitting API limits
- Stale data warning: Shows if data is older than 4 hours

## Limitations

- NOAA API has rate limits (be respectful with requests)
- Some remote locations may not have grid point coverage
- Current conditions may not always be available (falls back gracefully)
- Forecast is typically 7 days, but we store first 7 periods

## Future Enhancements

- Cache grid points to avoid repeated lookups
- Add retry logic for failed requests
- Store historical weather data for trends
- Add weather icons/images
- Alert on severe weather conditions

