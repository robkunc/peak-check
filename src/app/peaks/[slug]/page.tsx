import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import AddNoteForm from './add-note-form'
import Link from 'next/link'

export default async function PeakConditionsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  const { slug } = await params

  const peak = await prisma.peak.findUnique({
    where: { slug },
  })

  if (!peak) {
    notFound()
  }

  // Fetch latest weather snapshot
  const latestWeather = await prisma.weatherSnapshot.findFirst({
    where: { peakId: peak.id },
    orderBy: { fetchedAt: 'desc' },
  })

  // Fetch latest land status snapshots
  const landStatusSnapshots = await prisma.landStatusSnapshot.findMany({
    where: { peakId: peak.id },
    orderBy: { fetchedAt: 'desc' },
    include: {
      peakSource: true,
    },
  })

  const landStatuses = Array.from(
    new Map(landStatusSnapshots.map((s) => [s.peakSourceId, s])).values()
  )

  // Fetch latest road status snapshots
  const roadStatusSnapshots = await prisma.roadStatusSnapshot.findMany({
    where: { peakId: peak.id },
    orderBy: { fetchedAt: 'desc' },
    include: {
      peakSource: true,
    },
  })

  const roadStatuses = Array.from(
    new Map(roadStatusSnapshots.map((s) => [s.peakSourceId, s])).values()
  )

  // Fetch recent manual notes
  const notes = await prisma.manualNote.findMany({
    where: { peakId: peak.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/peaks"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Peaks
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{peak.name}</h1>
          <div className="flex gap-4 text-gray-600">
            {peak.region && <span className="text-lg">{peak.region}</span>}
            {peak.gpsLat && peak.gpsLng && (
              <span className="text-lg">
                {peak.gpsLat.toFixed(4)}°, {peak.gpsLng.toFixed(4)}°
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Weather Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Weather</h2>
            {latestWeather ? (
              <div>
                <p className="text-gray-700 text-lg mb-2">
                  {latestWeather.summaryText || 'No summary available'}
                </p>
                <p className="text-sm text-gray-500">
                  Last updated: {new Date(latestWeather.fetchedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-lg">
                No weather data available yet
              </p>
            )}
          </div>

          {/* Land Manager Status Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Land Manager Status
            </h2>
            {landStatuses.length > 0 ? (
              <div className="space-y-4">
                {landStatuses.map((status) => (
                  <div key={status.id} className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {status.peakSource.label}
                    </h3>
                    <p className="text-gray-700 mb-1">
                      {status.statusSummary || 'No summary available'}
                    </p>
                    {status.statusCode && (
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                        status.statusCode === 'open'
                          ? 'bg-green-100 text-green-800'
                          : status.statusCode === 'closed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {status.statusCode}
                      </span>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      Last updated: {new Date(status.fetchedAt).toLocaleString()}
                    </p>
                    <a
                      href={status.peakSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View source →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-lg">
                No land manager data configured yet
              </p>
            )}
          </div>

          {/* Road Status Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Road Status</h2>
            {roadStatuses.length > 0 ? (
              <div className="space-y-4">
                {roadStatuses.map((status) => (
                  <div key={status.id} className="border-l-4 border-orange-500 pl-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {status.peakSource.label}
                    </h3>
                    <p className="text-gray-700 mb-1">
                      {status.statusSummary || 'No summary available'}
                    </p>
                    {status.statusCode && (
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                        status.statusCode === 'open'
                          ? 'bg-green-100 text-green-800'
                          : status.statusCode === 'closed'
                          ? 'bg-red-100 text-red-800'
                          : status.statusCode === 'chains_required'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {status.statusCode.replace('_', ' ')}
                      </span>
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      Last updated: {new Date(status.fetchedAt).toLocaleString()}
                    </p>
                    <a
                      href={status.peakSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View source →
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-lg">
                No road status data configured yet
              </p>
            )}
          </div>

          {/* Manual Notes Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Leader Notes
            </h2>
            
            <AddNoteForm peakId={peak.id} />

            {notes.length > 0 ? (
              <div className="mt-6 space-y-4">
                {notes.map((note) => (
                  <div key={note.id} className="border-l-4 border-gray-300 pl-4 py-2">
                    <p className="text-gray-700 text-lg mb-2">{note.text}</p>
                    <p className="text-sm text-gray-500">
                      {note.user.name || note.user.email} •{' '}
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 mt-4">
                No notes yet. Be the first to add one!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


