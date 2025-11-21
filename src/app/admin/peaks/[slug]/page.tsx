import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import PeakEditForm from './peak-edit-form'
import SourcesList from './sources-list'
import RefreshJobsPanel from './refresh-jobs-panel'

export default async function AdminPeakDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== Role.ADMIN) {
    redirect('/admin')
  }

  const { slug } = await params

  const peak = await prisma.peak.findUnique({
    where: { slug },
    include: {
      sources: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          weatherSnapshots: true,
          landStatusSnapshots: true,
          roadStatusSnapshots: true,
          manualNotes: true,
        },
      },
    },
  })

  if (!peak) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/admin/peaks"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Peaks
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Edit Peak: {peak.name}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Peak Edit Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Peak Information
            </h2>
            <PeakEditForm peak={peak} />
          </div>

          {/* Data Sources */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Data Sources
            </h2>
            <SourcesList peakId={peak.id} peakSlug={peak.slug} sources={peak.sources} />
          </div>

          {/* Data Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Data Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  {peak._count.weatherSnapshots}
                </div>
                <div className="text-sm text-gray-600 mt-1">Weather Snapshots</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  {peak._count.landStatusSnapshots}
                </div>
                <div className="text-sm text-gray-600 mt-1">Land Status</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">
                  {peak._count.roadStatusSnapshots}
                </div>
                <div className="text-sm text-gray-600 mt-1">Road Status</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">
                  {peak._count.manualNotes}
                </div>
                <div className="text-sm text-gray-600 mt-1">Manual Notes</div>
              </div>
            </div>
          </div>

          {/* Refresh Jobs Panel */}
          <RefreshJobsPanel peakId={peak.id} peakSlug={peak.slug} />
        </div>
      </div>
    </div>
  )
}

