# Import Guide: Peaks and Data Sources

This guide explains how to populate the database with peaks and configure data sources for road closures and land manager status.

## Step 1: Import Peaks from Hundred Peaks Section

The HPS website has a comprehensive list of ~250 peaks. Import them all:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/import-hps-peaks.ts
```

This script will:
- Scrape the HPS peaks list page using Firecrawl
- Parse all peaks with their elevations and sections
- Create or update peaks in the database
- Preserve existing peaks (updates name/region if changed)

**Note:** You need `FIRECRAWL_API_KEY` set in your `.env.local` file.

## Step 2: Add Common Data Sources

After importing peaks, add common land manager and road status sources:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/add-common-sources.ts
```

This script adds sources like:
- **Land Manager Sources:**
  - Angeles National Forest
  - San Bernardino National Forest
  - Cleveland National Forest
  - Los Padres National Forest
  - Inyo National Forest

- **Road Status Sources:**
  - Caltrans District 7 (LA/Ventura)
  - Caltrans District 8 (San Bernardino/Riverside)
  - Caltrans District 11 (San Diego)

Sources are automatically matched to peaks based on region.

## Step 3: Add GPS Coordinates (Optional but Recommended)

GPS coordinates are needed for weather data. You can:

1. **Add manually via admin interface:**
   - Go to `/admin/peaks`
   - Click "Edit" on a peak
   - Add GPS coordinates

2. **Or use the HPS coordinates table:**
   - The HPS website has a coordinates table
   - You can create a script to import those if needed

## Step 4: Trigger Data Refresh

Once sources are configured, trigger the background jobs to fetch data:

### Option A: Via Admin Interface
1. Go to `/admin/peaks/[slug]` for any peak
2. Scroll to "Manual Data Refresh" section
3. Click "Refresh Weather", "Refresh Land Status", or "Refresh Road Status"

### Option B: Via API (for all peaks)
```bash
# Refresh weather (requires CRON_SECRET if set)
curl -X POST http://localhost:3001/api/jobs/refresh-weather \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Refresh land status
curl -X POST http://localhost:3001/api/jobs/refresh-land-status \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Refresh road status
curl -X POST http://localhost:3001/api/jobs/refresh-road-status \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option C: Automatic (Production)
Once deployed to Vercel, the cron jobs in `vercel.json` will run automatically:
- Weather: Every 3 hours
- Land Status: Every 6 hours
- Road Status: Every 3 hours

## Why No Data Shows Up

If you see "No land manager data configured yet" or "No road status data configured yet" on a peak's conditions page, it means:

1. **No sources configured:** The peak doesn't have any land manager or road status sources added yet
2. **No snapshots fetched:** Sources exist but the refresh jobs haven't run yet
3. **Scraping failed:** The source URL might be inaccessible or the parsing failed

**Solution:** 
- Add sources using the admin interface or the `add-common-sources.ts` script
- Then trigger the refresh jobs

## Customizing Sources

You can customize the sources in `scripts/add-common-sources.ts`:

1. Edit the `commonSources` array
2. Add your own sources with URLs
3. Specify `regionMatch` to limit which peaks get the source
4. Run the script again (it will skip sources that already exist)

## Adding Sources Manually

You can also add sources manually via the admin interface:

1. Go to `/admin/peaks/[slug]` for a specific peak
2. Scroll to "Data Sources" section
3. Click "+ Add Data Source"
4. Fill in:
   - **Source Type:** Land Manager, Road Status, or Trail Info
   - **Label:** A descriptive name (e.g., "Angeles NF Current Conditions")
   - **URL:** The URL to scrape

## Troubleshooting

### Import Script Fails
- Check that `FIRECRAWL_API_KEY` is set
- Check that Firecrawl API is accessible
- The parsing logic may need adjustment if the HPS website structure changes

### No Data After Refresh
- Check that sources are actually configured (go to admin interface)
- Check server logs for scraping errors
- Verify the source URLs are accessible
- Some sites may block automated scraping

### Missing GPS Coordinates
- Weather data requires GPS coordinates
- Add them manually via admin interface
- Or create a script to import from HPS coordinates table

