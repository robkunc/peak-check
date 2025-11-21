'use client'

import { useState } from 'react'
import AlertModal from '@/components/alert-modal'

interface RefreshJobsPanelProps {
  peakId: string
  peakSlug: string
}

export default function RefreshJobsPanel({ peakId, peakSlug }: RefreshJobsPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState<{
    weather: boolean
    land: boolean
    road: boolean
  }>({
    weather: false,
    land: false,
    road: false,
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

  const triggerRefresh = async (jobType: 'weather' | 'land' | 'road') => {
    setIsRefreshing({ ...isRefreshing, [jobType]: true })

    try {
      let endpoint = ''
      switch (jobType) {
        case 'weather':
          endpoint = '/api/jobs/refresh-weather'
          break
        case 'land':
          endpoint = '/api/jobs/refresh-land-status'
          break
        case 'road':
          endpoint = '/api/jobs/refresh-road-status'
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to trigger ${jobType} refresh`)
      }

      const result = await response.json()

      setAlertModal({
        isOpen: true,
        title: 'Success',
        message: `${jobType.charAt(0).toUpperCase() + jobType.slice(1)} refresh triggered successfully! ${
          result.results ? `Processed ${result.results.successful} items.` : ''
        }`,
        variant: 'success',
      })
    } catch (error) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to trigger refresh',
        variant: 'error',
      })
    } finally {
      setIsRefreshing({ ...isRefreshing, [jobType]: false })
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Manual Data Refresh
        </h2>
        <p className="text-gray-600 mb-4">
          Trigger manual refresh jobs for all peaks. These jobs will process all peaks with
          configured data sources.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => triggerRefresh('weather')}
            disabled={isRefreshing.weather}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {isRefreshing.weather ? 'Refreshing...' : 'Refresh Weather'}
          </button>

          <button
            onClick={() => triggerRefresh('land')}
            disabled={isRefreshing.land}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {isRefreshing.land ? 'Refreshing...' : 'Refresh Land Status'}
          </button>

          <button
            onClick={() => triggerRefresh('road')}
            disabled={isRefreshing.road}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {isRefreshing.road ? 'Refreshing...' : 'Refresh Road Status'}
          </button>
        </div>
      </div>

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

