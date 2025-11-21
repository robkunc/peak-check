import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import Link from 'next/link'

export default async function AdminPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== Role.ADMIN) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-lg text-gray-600 mb-6">
            You need administrator privileges to access this page.
          </p>
          <Link
            href="/peaks"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold"
          >
            Back to Peaks
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/peaks"
            className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Manage Peaks
            </h2>
            <p className="text-gray-600">
              Add, edit, or remove peaks from the catalog. Configure data sources
              for each peak.
            </p>
          </Link>

          <div className="bg-gray-100 rounded-lg shadow p-6 opacity-50">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              Background Jobs
            </h2>
            <p className="text-gray-500">
              View and manage data refresh jobs (coming in Phase 3-4)
            </p>
          </div>

          <Link
            href="/admin/users"
            className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              User Management
            </h2>
            <p className="text-gray-600">
              Add and manage users who can access the peak conditions system.
            </p>
          </Link>

          <div className="bg-gray-100 rounded-lg shadow p-6 opacity-50">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              System Settings
            </h2>
            <p className="text-gray-500">
              Configure API keys and refresh intervals (future enhancement)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


