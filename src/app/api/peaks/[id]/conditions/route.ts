import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET /api/peaks/[id]/conditions - Get aggregated conditions for a peak
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    // Fetch peak
    const peak = await prisma.peak.findUnique({
      where: { id },
    })

    if (!peak) {
      return NextResponse.json({ error: 'Peak not found' }, { status: 404 })
    }

    // Fetch latest weather snapshot
    const latestWeather = await prisma.weatherSnapshot.findFirst({
      where: { peakId: id },
      orderBy: { fetchedAt: 'desc' },
      select: {
        summaryText: true,
        fetchedAt: true,
        rawJson: true,
      },
    })

    // Fetch latest land status snapshots (one per source)
    const landStatusSnapshots = await prisma.landStatusSnapshot.findMany({
      where: { peakId: id },
      orderBy: { fetchedAt: 'desc' },
      include: {
        peakSource: {
          select: {
            label: true,
            url: true,
          },
        },
      },
    })

    // Get unique latest snapshots per source
    const landStatuses = Array.from(
      new Map(
        landStatusSnapshots.map((s) => [
          s.peakSourceId,
          {
            id: s.id,
            label: s.peakSource.label,
            url: s.peakSource.url,
            statusSummary: s.statusSummary,
            statusCode: s.statusCode,
            fetchedAt: s.fetchedAt,
          },
        ])
      ).values()
    )

    // Fetch latest road status snapshots (one per source)
    const roadStatusSnapshots = await prisma.roadStatusSnapshot.findMany({
      where: { peakId: id },
      orderBy: { fetchedAt: 'desc' },
      include: {
        peakSource: {
          select: {
            label: true,
            url: true,
          },
        },
      },
    })

    // Get unique latest snapshots per source
    const roadStatuses = Array.from(
      new Map(
        roadStatusSnapshots.map((s) => [
          s.peakSourceId,
          {
            id: s.id,
            label: s.peakSource.label,
            url: s.peakSource.url,
            statusSummary: s.statusSummary,
            statusCode: s.statusCode,
            fetchedAt: s.fetchedAt,
          },
        ])
      ).values()
    )

    // Fetch recent manual notes
    const notes = await prisma.manualNote.findMany({
      where: { peakId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      peak,
      weather: latestWeather,
      landStatuses,
      roadStatuses,
      notes,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching conditions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


