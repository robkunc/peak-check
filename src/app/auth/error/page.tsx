export default function AuthError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-gray-600 text-lg mb-6">
          There was a problem signing you in. Please try again.
        </p>
        <a
          href="/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 text-lg font-semibold"
        >
          Back to Sign In
        </a>
      </div>
    </div>
  )
}


