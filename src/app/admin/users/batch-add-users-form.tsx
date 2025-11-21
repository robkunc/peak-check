'use client'

import { useState } from 'react'
import { Role } from '@prisma/client'
import AlertModal from '@/components/alert-modal'

export default function BatchAddUsersForm() {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<Role>(Role.LEADER)
  const [isLoading, setIsLoading] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string; details?: any } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setAlert(null)

    try {
      // Parse emails from textarea (one per line, trim whitespace, filter empty)
      const emailList = emails
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      if (emailList.length === 0) {
        throw new Error('Please enter at least one email address')
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: emailList,
          role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create users')
      }

      const { summary, results } = data
      let message = `Batch operation complete: ${summary.created} created`
      if (summary.skipped > 0) {
        message += `, ${summary.skipped} skipped (already exist)`
      }
      if (summary.errors > 0) {
        message += `, ${summary.errors} errors`
      }

      setAlert({
        type: summary.errors > 0 ? 'error' : 'success',
        message,
        details: results,
      })
      setEmails('')
      setRole(Role.LEADER)
      
      // Refresh the users list
      window.dispatchEvent(new Event('users-updated'))
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create users',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="emails" className="block text-sm font-medium text-gray-700 mb-2">
            Email Addresses (one per line) *
          </label>
          <textarea
            id="emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            required
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white font-mono text-sm"
            placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
          />
          <p className="mt-1 text-sm text-gray-500">
            Enter one email address per line. Users will need to sign in via magic link to verify their email.
          </p>
        </div>

        <div>
          <label htmlFor="batch-role" className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            id="batch-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value={Role.LEADER}>Leader</option>
            <option value={Role.ADMIN}>Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors"
        >
          {isLoading ? 'Creating Users...' : 'Create Users'}
        </button>
      </form>

      {alert && (
        <AlertModal
          isOpen={true}
          onClose={() => setAlert(null)}
          title={alert.type === 'success' ? 'Batch Operation Complete' : 'Error'}
          message={alert.message}
          variant={alert.type}
        />
      )}
    </>
  )
}

