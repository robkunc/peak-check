import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-utils'
import { z } from 'zod'

// PATCH /api/sources/[sourceId] - Update a source (admin)
const updateSourceSchema = z.object({
  sourceType: z.enum(['LAND_MANAGER', 'ROAD_STATUS', 'TRAIL_INFO']).optional(),
  label: z.string().min(1).optional(),
  url: z.string().url().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    await requireAdmin()
    const { sourceId } = await params

    const body = await request.json()
    const data = updateSourceSchema.parse(body)

    const source = await prisma.peakSource.update({
      where: { id: sourceId },
      data,
    })

    return NextResponse.json({ source })
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
    console.error('Error updating source:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/sources/[sourceId] - Delete a source (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    await requireAdmin()
    const { sourceId } = await params

    await prisma.peakSource.delete({
      where: { id: sourceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('Error deleting source:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


