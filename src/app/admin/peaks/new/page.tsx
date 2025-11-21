import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import Link from 'next/link'
import NewPeakForm from './new-peak-form'

export default async function NewPeakPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/auth/signin')
  }

  if (user.role !== Role.ADMIN) {
    redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/admin/peaks"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Peaks
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Add New Peak</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <NewPeakForm />
        </div>
      </div>
    </div>
  )
}

