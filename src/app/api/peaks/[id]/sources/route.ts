import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-utils'
import { z } from 'zod'
import { SourceType } from '@prisma/client'

// GET /api/peaks/[id]/sources - Get sources for a peak (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const sources = await prisma.peakSource.findMany({
      where: { peakId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ sources })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('Error fetching sources:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/peaks/[id]/sources - Create a new source (admin)
const createSourceSchema = z.object({
  sourceType: z.enum(['LAND_MANAGER', 'ROAD_STATUS', 'TRAIL_INFO']),
  label: z.string().min(1),
  url: z.string().url(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const body = await request.json()
    const data = createSourceSchema.parse(body)

    const source = await prisma.peakSource.create({
      data: {
        peakId: id,
        ...data,
      },
    })

    return NextResponse.json({ source }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Error creating source:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


