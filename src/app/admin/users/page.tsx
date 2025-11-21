import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-utils'
import { Role } from '@prisma/client'
import UsersList from './users-list'
import AddUserForm from './add-user-form'
import BatchAddUsersForm from './batch-add-users-form'

export default async function UsersPage() {
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
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-lg text-gray-600">
            Add and manage users who can access the peak conditions system.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Add Single User */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Add Single User
            </h2>
            <AddUserForm />
          </div>

          {/* Batch Add Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Batch Add Users
            </h2>
            <BatchAddUsersForm />
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">All Users</h2>
          </div>
          <UsersList />
        </div>
      </div>
    </div>
  )
}

