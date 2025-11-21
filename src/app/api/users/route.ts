import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { z } from 'zod'

// Schema for creating a single user
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.LEADER),
})

// Schema for batch creating users
const batchCreateUsersSchema = z.object({
  emails: z.array(z.string().email('Invalid email address')),
  role: z.nativeEnum(Role).default(Role.LEADER),
})

/**
 * GET /api/users
 * List all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a single user or batch create users (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()

    // Check if this is a batch create request
    if (body.emails && Array.isArray(body.emails)) {
      // Batch create
      const { emails, role = Role.LEADER } = batchCreateUsersSchema.parse(body)

      const results = {
        created: [] as Array<{ email: string; id: string }>,
        skipped: [] as Array<{ email: string; reason: string }>,
        errors: [] as Array<{ email: string; error: string }>,
      }

      for (const email of emails) {
        try {
          // Check if user already exists
          const existing = await prisma.user.findUnique({
            where: { email: email.trim() },
          })

          if (existing) {
            results.skipped.push({
              email: email.trim(),
              reason: 'User already exists',
            })
            continue
          }

          // Create user
          const user = await prisma.user.create({
            data: {
              email: email.trim(),
              name: email.trim().split('@')[0],
              role,
              emailVerified: null, // They'll need to verify via magic link
            },
          })

          results.created.push({
            email: user.email,
            id: user.id,
          })
        } catch (error) {
          results.errors.push({
            email: email.trim(),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: emails.length,
          created: results.created.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
        },
      })
    } else {
      // Single user create
      const { email, name, role = Role.LEADER } = createUserSchema.parse(body)

      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { email },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          role,
          emailVerified: null, // They'll need to verify via magic link
        },
      })

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

