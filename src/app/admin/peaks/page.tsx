import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import Link from 'next/link'

export default async function AdminPeaksPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== Role.ADMIN) {
    redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Admin
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Manage Peaks</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Coming in Phase 5
          </h2>
          <p className="text-gray-600 mb-6">
            The full admin interface for managing peaks and data sources will be
            implemented in Phase 5 of the project.
          </p>
          <p className="text-gray-600 mb-6">
            For now, you can use Prisma Studio to manually add peaks:
          </p>
          <code className="block bg-gray-100 p-4 rounded mb-6 text-left">
            npx prisma studio
          </code>
          <p className="text-gray-600">
            Or use the API endpoints directly at:
          </p>
          <ul className="text-left text-gray-600 mt-4 space-y-2">
            <li>• POST /api/peaks - Create a peak</li>
            <li>• PATCH /api/peaks/[id] - Update a peak</li>
            <li>• DELETE /api/peaks/[id] - Delete a peak</li>
            <li>• POST /api/peaks/[id]/sources - Add data sources</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


