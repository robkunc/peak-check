'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddNoteForm({ peakId }: { peakId: string }) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/peaks/${peakId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Failed to add note')
      }

      setText('')
      router.refresh()
    } catch (err) {
      setError('Failed to add note. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <label htmlFor="note" className="block text-lg font-medium text-gray-700 mb-2">
        Add a Note
      </label>
      <textarea
        id="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        rows={4}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
        placeholder="Share recent trip conditions, trail status, or other observations..."
      />
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting || !text.trim()}
        className="mt-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-semibold transition-colors"
      >
        {isSubmitting ? 'Adding...' : 'Add Note'}
      </button>
    </form>
  )
}


