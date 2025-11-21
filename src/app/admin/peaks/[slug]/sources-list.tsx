'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PeakSource, SourceType } from '@prisma/client'
import ConfirmModal from '@/components/confirm-modal'
import AlertModal from '@/components/alert-modal'
import AddSourceForm from './add-source-form'

interface SourcesListProps {
  peakId: string
  peakSlug: string
  sources: PeakSource[]
}

export default function SourcesList({ peakId, peakSlug, sources }: SourcesListProps) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    sourceId: string | null
    sourceLabel: string
  }>({
    isOpen: false,
    sourceId: null,
    sourceLabel: '',
  })
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'success' | 'error'
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'success',
  })

  const handleDelete = async () => {
    if (!deleteModal.sourceId) return

    try {
      const response = await fetch(`/api/sources/${deleteModal.sourceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete source')
      }

      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: 'Source deleted successfully!',
        variant: 'success',
      })

      setDeleteModal({ isOpen: false, sourceId: null, sourceLabel: '' })
      router.refresh()
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete source',
        variant: 'error',
      })
    }
  }

  const getSourceTypeLabel = (type: SourceType) => {
    switch (type) {
      case 'LAND_MANAGER':
        return 'Land Manager'
      case 'ROAD_STATUS':
        return 'Road Status'
      case 'TRAIL_INFO':
        return 'Trail Info'
      default:
        return type
    }
  }

  const getSourceTypeColor = (type: SourceType) => {
    switch (type) {
      case 'LAND_MANAGER':
        return 'bg-blue-100 text-blue-800'
      case 'ROAD_STATUS':
        return 'bg-orange-100 text-orange-800'
      case 'TRAIL_INFO':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      <div className="space-y-4">
        {sources.length === 0 && !isAdding && (
          <p className="text-gray-500 text-center py-8">
            No data sources configured. Add one to start collecting data.
          </p>
        )}

        {sources.map((source) => (
          <div
            key={source.id}
            className="border border-gray-200 rounded-lg p-4 flex items-start justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded ${getSourceTypeColor(
                    source.sourceType
                  )}`}
                >
                  {getSourceTypeLabel(source.sourceType)}
                </span>
                <h3 className="font-semibold text-gray-900">{source.label}</h3>
              </div>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm break-all"
              >
                {source.url}
              </a>
            </div>
            <button
              onClick={() =>
                setDeleteModal({
                  isOpen: true,
                  sourceId: source.id,
                  sourceLabel: source.label,
                })
              }
              className="ml-4 text-red-600 hover:text-red-800 font-medium text-sm"
            >
              Delete
            </button>
          </div>
        ))}

        {isAdding ? (
          <AddSourceForm
            peakId={peakId}
            onSuccess={() => {
              setIsAdding(false)
              router.refresh()
            }}
            onCancel={() => setIsAdding(false)}
          />
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 font-medium"
          >
            + Add Data Source
          </button>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, sourceId: null, sourceLabel: '' })}
        onConfirm={handleDelete}
        title="Delete Source"
        message={`Are you sure you want to delete "${deleteModal.sourceLabel}"? This will also delete all associated snapshots.`}
        confirmText="Delete"
        variant="danger"
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </>
  )
}

