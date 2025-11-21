'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import EditNoteForm from './edit-note-form'
import AddNoteForm from './add-note-form'
import ConfirmModal from '@/components/confirm-modal'
import AlertModal from '@/components/alert-modal'

interface Note {
  id: string
  text: string
  createdAt: string
  user: {
    name: string | null
    email: string
  }
}

interface NotesSectionProps {
  peakId: string
  initialNotes: Note[]
  initialTotal: number
}

export default function NotesSection({ peakId, initialNotes, initialTotal }: NotesSectionProps) {
  const { data: session } = useSession()
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(initialTotal)
  const [isLoading, setIsLoading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const limit = 20

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadNotes = async (pageNum: number) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/peaks/${peakId}/notes?page=${pageNum}&limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('Error loading notes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteClick = (noteId: string) => {
    setNoteToDelete(noteId)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!noteToDelete) return

    try {
      const response = await fetch(`/api/notes/${noteToDelete}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Reload notes
        await loadNotes(page)
        setNoteToDelete(null)
      } else {
        const error = await response.json()
        setAlertMessage(error.error || 'Failed to delete note')
        setAlertOpen(true)
        setNoteToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting note:', error)
      setAlertMessage('Failed to delete note. Please try again.')
      setAlertOpen(true)
      setNoteToDelete(null)
    }
  }

  const handleNoteUpdated = () => {
    setEditingNoteId(null)
    loadNotes(page)
  }

  const handleNoteCreated = async () => {
    // Reload first page to show new note
    await loadNotes(1)
    setPage(1)
  }

  const isOwnNote = (note: Note) => {
    return session?.user?.email === note.user.email
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const totalPages = Math.ceil(total / limit)

  if (!mounted) {
    // Prevent hydration mismatch
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Leader Notes</h2>
        <div className="mb-6">
          <label className="block text-lg font-medium text-gray-700 mb-2">Add a Note</label>
          <textarea
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-gray-900 bg-white"
            placeholder="Share recent trip conditions, trail status, or other observations..."
            disabled
          />
          <button
            disabled
            className="mt-3 px-6 py-3 bg-gray-400 text-white rounded-lg text-lg font-semibold"
          >
            Add Note
          </button>
        </div>
        {notes.length > 0 && (
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="border-l-4 border-gray-300 pl-4 py-3 bg-gray-50 rounded-r-lg">
                <p className="text-gray-900 text-lg mb-2 whitespace-pre-wrap font-medium">{note.text}</p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{note.user.name || note.user.email}</span>
                  {' • '}
                  {formatDate(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Leader Notes</h2>

      <AddNoteForm peakId={peakId} onNoteCreated={handleNoteCreated} />

      {notes.length > 0 ? (
        <>
          <div className="space-y-4 mb-6">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border-l-4 border-gray-300 pl-4 py-3 bg-gray-50 rounded-r-lg"
              >
                {editingNoteId === note.id ? (
                  <EditNoteForm
                    noteId={note.id}
                    initialText={note.text}
                    onCancel={() => setEditingNoteId(null)}
                    onSuccess={handleNoteUpdated}
                  />
                ) : (
                  <>
                    <p className="text-gray-900 text-lg mb-2 whitespace-pre-wrap font-medium">{note.text}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{note.user.name || note.user.email}</span>
                        {' • '}
                        {formatDate(note.createdAt)}
                      </p>
                      {isOwnNote(note) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingNoteId(note.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(note.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <button
                onClick={() => {
                  const newPage = page - 1
                  setPage(newPage)
                  loadNotes(newPage)
                }}
                disabled={page === 1 || isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages} ({total} total notes)
              </span>
              <button
                onClick={() => {
                  const newPage = page + 1
                  setPage(newPage)
                  loadNotes(newPage)
                }}
                disabled={page >= totalPages || isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No notes yet. Be the first to add one!</p>
      )}

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false)
          setNoteToDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Error"
        message={alertMessage}
        variant="error"
      />
    </div>
  )
}

