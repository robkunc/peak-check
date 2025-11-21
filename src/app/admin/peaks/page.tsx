import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminPeaksPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== Role.ADMIN) {
    redirect('/admin')
  }

  // Fetch all peaks
  const peaks = await prisma.peak.findMany({
    orderBy: [
      { isActive: 'desc' },
      { name: 'asc' },
    ],
    include: {
      _count: {
        select: {
          sources: true,
          weatherSnapshots: true,
          landStatusSnapshots: true,
          roadStatusSnapshots: true,
          manualNotes: true,
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
            >
              ← Back to Admin
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Manage Peaks</h1>
            <p className="text-gray-600">
              {peaks.length} peak{peaks.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Link
            href="/admin/peaks/new"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg"
          >
            + Add New Peak
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GPS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Sources
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {peaks.map((peak) => (
                  <tr key={peak.id} className={!peak.isActive ? 'opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {peak.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            /{peak.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{peak.region || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {peak.gpsLat && peak.gpsLng ? (
                          <>
                            {peak.gpsLat.toFixed(4)}°, {peak.gpsLng.toFixed(4)}°
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          peak.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {peak.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 space-y-1">
                        <div>Sources: {peak._count.sources}</div>
                        <div className="text-xs text-gray-500">
                          Weather: {peak._count.weatherSnapshots} | Land: {peak._count.landStatusSnapshots} | Road: {peak._count.roadStatusSnapshots} | Notes: {peak._count.manualNotes}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/peaks/${peak.slug}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/peaks/${peak.slug}`}
                          className="text-gray-600 hover:text-gray-900"
                          target="_blank"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
