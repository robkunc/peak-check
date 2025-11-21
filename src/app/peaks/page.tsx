import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PeaksPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  const peaks = await prisma.peak.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })

  // Group peaks by region
  const peaksByRegion = peaks.reduce((acc, peak) => {
    const region = peak.region || 'Other'
    if (!acc[region]) {
      acc[region] = []
    }
    acc[region].push(peak)
    return acc
  }, {} as Record<string, typeof peaks>)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Peak List</h1>
          <p className="text-lg text-gray-600">
            Click on a peak to view current conditions
          </p>
        </div>

        {Object.keys(peaksByRegion).length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 text-lg">
              No peaks found. Contact an administrator to add peaks.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(peaksByRegion).map(([region, regionPeaks]) => (
              <div key={region} className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-900">{region}</h2>
                  <p className="text-sm text-gray-500">{regionPeaks.length} peaks</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {regionPeaks.map((peak) => (
                      <Link
                        key={peak.id}
                        href={`/peaks/${peak.slug}`}
                        className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {peak.name}
                        </h3>
                        {(peak.gpsLat && peak.gpsLng) && (
                          <p className="text-sm text-gray-500">
                            {peak.gpsLat.toFixed(4)}°, {peak.gpsLng.toFixed(4)}°
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


