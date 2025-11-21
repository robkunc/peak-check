'use client'

interface WeatherPanelProps {
  summaryText: string | null
  fetchedAt: Date | string | null
  rawJson?: any
}

export default function WeatherPanel({ summaryText, fetchedAt, rawJson }: WeatherPanelProps) {
  const fetchedAtDate = fetchedAt ? new Date(fetchedAt) : null
  
  if (!summaryText && !fetchedAtDate) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Weather</h2>
        <p className="text-gray-500 text-lg">
          No weather data available yet. Weather data is updated every 3 hours.
        </p>
      </div>
    )
  }

  const isStale = fetchedAtDate
    ? new Date().getTime() - fetchedAtDate.getTime() > 4 * 60 * 60 * 1000 // 4 hours
    : false

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Weather</h2>
        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded">
          NOAA
        </span>
      </div>

      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Weather data is from the nearest NOAA weather station at ground level. 
          Conditions at the peak elevation may differ significantly (colder, windier, more extreme).
        </p>
      </div>

      {summaryText && (
        <div className="mb-4">
          <p className="text-gray-900 text-lg leading-relaxed">{summaryText}</p>
        </div>
      )}

      {rawJson?.forecast && rawJson.forecast.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Extended Forecast</h3>
          <div className="space-y-4">
            {rawJson.forecast.slice(0, 7).map((period: any, index: number) => (
              <div
                key={index}
                className="py-3 px-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 text-lg">{period.name}</h4>
                  <p className="font-semibold text-gray-900 text-lg">
                    {period.temperature}°{period.temperatureUnit}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {period.shortForecast}
                </p>
                {period.detailedForecast && (
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {period.detailedForecast}
                  </p>
                )}
                {(period.windSpeed || period.windDirection) && (
                  <p className="text-xs text-gray-500 mt-2">
                    Wind: {period.windSpeed || 'N/A'}
                    {period.windDirection && ` from ${period.windDirection}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          {fetchedAtDate ? (
            <>
              Last updated: {fetchedAtDate.toLocaleString()}
              {isStale && (
                <span className="ml-2 text-yellow-600 font-medium">
                  (Data may be outdated)
                </span>
              )}
            </>
          ) : (
            'Last updated: Unknown'
          )}
        </p>
      </div>
    </div>
  )
}

