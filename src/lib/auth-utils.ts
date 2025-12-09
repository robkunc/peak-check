import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { Role } from '@prisma/client'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session) {
    console.log('[Auth Debug] getCurrentUser: No session found')
  } else {
    // console.log('[Auth Debug] getCurrentUser: Session found for user', session.user?.email)
  }
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== Role.ADMIN) {
    throw new Error('Unauthorized')
  }
  return user
}

export function isAdmin(user: { role?: string | null } | null): boolean {
  return user?.role === 'ADMIN'
}


