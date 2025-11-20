import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Peak Not Found</h1>
        <p className="text-lg text-gray-600 mb-6">
          The peak you&apos;re looking for doesn&apos;t exist.
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

