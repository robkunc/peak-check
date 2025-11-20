'use client'

import { signIn, getProviders } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [providers, setProviders] = useState<any>(null)

  useEffect(() => {
    getProviders().then(setProviders)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: '/peaks',
      })

      if (result?.error) {
        setMessage('Error signing in. Please try again.')
      } else {
        setMessage('Check your email for a sign-in link!')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Show message if no providers are configured
  if (providers && Object.keys(providers).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Authentication Not Configured
          </h1>
          <div className="space-y-4 text-gray-600">
            <p>
              No authentication providers are configured. Please set up one of the following:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Email:</strong> Add EMAIL_SERVER_HOST, EMAIL_SERVER_USER, and
                EMAIL_SERVER_PASSWORD to your .env.local file
              </li>
              <li>
                <strong>Google OAuth:</strong> Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to
                your .env.local file
              </li>
            </ul>
            <p className="mt-4 text-sm">
              For development, you can create test users directly in the database using:
            </p>
            <code className="block bg-gray-100 p-3 rounded text-sm">
              {`npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/create-test-user.ts your-email@example.com`}
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Sign In
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Sign in to access the Peak Conditions Assistant
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              placeholder="your.email@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-semibold transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${message.includes('Check') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}


