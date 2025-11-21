import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { z } from 'zod'

// PATCH /api/notes/[noteId] - Update a note (only own notes)
const updateNoteSchema = z.object({
  text: z.string().min(1),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const user = await requireAuth()
    const { noteId } = await params

    const body = await request.json()
    const { text } = updateNoteSchema.parse(body)

    // Check if note exists and belongs to user
    const existingNote = await prisma.manualNote.findUnique({
      where: { id: noteId },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (existingNote.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own notes' }, { status: 403 })
    }

    const note = await prisma.manualNote.update({
      where: { id: noteId },
      data: { text },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ note })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Error updating note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notes/[noteId] - Delete a note (only own notes)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const user = await requireAuth()
    const { noteId } = await params

    // Check if note exists and belongs to user
    const existingNote = await prisma.manualNote.findUnique({
      where: { id: noteId },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (existingNote.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own notes' }, { status: 403 })
    }

    await prisma.manualNote.delete({
      where: { id: noteId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    console.error('Error deleting note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

