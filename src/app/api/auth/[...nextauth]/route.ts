// Suppress url.parse() deprecation warning from NextAuth v4
import '@/lib/suppress-deprecation-warning'

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

// Force dynamic rendering and disable caching for auth routes
export const dynamic = 'force-dynamic'
export const revalidate = 0

export { handler as GET, handler as POST }


