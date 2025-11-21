/**
 * Test script to verify NOAA weather API integration
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-weather-api.ts
 */

import { fetchWeatherForPeak } from '../src/lib/noaa-api'

async function testWeatherAPI() {
  console.log('🌤️  Testing NOAA Weather API Integration...\n')

  // Test with Mount Baldy coordinates (San Gabriel Mountains)
  const testLat = 34.2892
  const testLng = -117.6462

  console.log(`Testing with coordinates: ${testLat}, ${testLng} (Mount Baldy)\n`)

  try {
    const weatherData = await fetchWeatherForPeak(testLat, testLng)

    console.log('✅ Weather data fetched successfully!\n')
    console.log('Summary:', weatherData.summaryText)
    console.log('\nRaw JSON structure:')
    console.log('- Grid Point:', weatherData.rawJson.gridPoint)
    console.log('- Current Conditions:', weatherData.rawJson.current)
    console.log('- Forecast Periods:', weatherData.rawJson.forecast.length, 'periods')
    console.log('\nFirst forecast period:')
    if (weatherData.rawJson.forecast.length > 0) {
      console.log(JSON.stringify(weatherData.rawJson.forecast[0], null, 2))
    }

    console.log('\n✅ All tests passed!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error testing weather API:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

testWeatherAPI()

