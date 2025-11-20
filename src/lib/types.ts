import { Peak, PeakSource, ManualNote, User } from '@prisma/client'

// Extended types for API responses
export type PeakWithSources = Peak & {
  sources: PeakSource[]
}

export type PeakConditions = {
  peak: Peak
  weather: {
    summaryText: string | null
    fetchedAt: Date | null
  } | null
  landStatuses: Array<{
    label: string
    statusSummary: string | null
    statusCode: string | null
    fetchedAt: Date
  }>
  roadStatuses: Array<{
    label: string
    statusSummary: string | null
    statusCode: string | null
    fetchedAt: Date
  }>
  notes: Array<ManualNote & {
    user: {
      name: string | null
      email: string
    }
  }>
}

export type StatusCode = 'open' | 'closed' | 'restricted' | 'chains_required' | 'unknown'


