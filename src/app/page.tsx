import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Sierra Club Peak Conditions Assistant
        </h1>
        <p className="text-xl text-gray-700 mb-8">
          Internal tool for Southern California outing leaders to check current conditions 
          for ~250 peaks before planning trips.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/peaks"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg font-semibold transition-colors"
          >
            View Peaks
          </Link>
          <Link
            href="/admin"
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-lg font-semibold transition-colors"
          >
            Admin
          </Link>
        </div>
      </div>
    </main>
  )
}


