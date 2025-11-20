'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

export default function Navigation() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return null
  }

  if (!session) {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN'

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              Peak Conditions
            </Link>
            
            <div className="flex space-x-4">
              <Link
                href="/peaks"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname?.startsWith('/peaks')
                    ? 'bg-blue-700'
                    : 'hover:bg-blue-500'
                }`}
              >
                Peaks
              </Link>
              
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname?.startsWith('/admin')
                      ? 'bg-blue-700'
                      : 'hover:bg-blue-500'
                  }`}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm">
              {session.user.name || session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-md text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}


