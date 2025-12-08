// Suppress url.parse() deprecation warning from NextAuth v4
import '@/lib/suppress-deprecation-warning'

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const handler = NextAuth(authOptions)

// Force dynamic rendering and disable caching for auth routes
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Wrap handler with error handling
async function wrappedHandler(req: NextRequest) {
  try {
    return await handler(req)
  } catch (error) {
    console.error('[NextAuth Error]', error)
    // Log the full error details
    if (error instanceof Error) {
      console.error('[NextAuth Error Details]', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }
    // Return a proper error response
    return NextResponse.json(
      { 
        error: 'Authentication error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export { wrappedHandler as GET, wrappedHandler as POST }


