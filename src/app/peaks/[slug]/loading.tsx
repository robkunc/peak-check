export default function PeakLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <div className="space-y-6">
          {/* Weather skeleton */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Land Manager skeleton */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-7 w-56 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="border-l-4 border-blue-500 pl-4 space-y-3">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Road Status skeleton */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-7 w-40 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="border-l-4 border-orange-500 pl-4 space-y-3">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Notes skeleton */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-7 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

