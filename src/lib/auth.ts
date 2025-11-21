import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'
import { Adapter } from 'next-auth/adapters'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    // Only enable email provider if email server is configured
    ...(process.env.EMAIL_SERVER_HOST &&
    process.env.EMAIL_SERVER_USER &&
    process.env.EMAIL_SERVER_PASSWORD
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT) || 587,
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              },
            },
            from: process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER,
          }),
        ]
      : []),
    // Optional Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // PrismaAdapter handles user creation automatically
      // Just log for debugging
      console.log('[NextAuth signIn]', { 
        email: user.email, 
        provider: account?.provider,
        hasAccount: !!account 
      })
      return true
    },
    async session({ session, user }) {
      try {
        if (session.user) {
          session.user.id = user.id
          // Fetch user role from database
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          })
          session.user.role = dbUser?.role || 'LEADER'
          console.log('[NextAuth session]', { userId: user.id, role: session.user.role })
        }
      } catch (error) {
        console.error('[NextAuth session error]', error)
        // Don't fail the session, just use default role
        if (session.user) {
          session.user.role = 'LEADER'
        }
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Log for debugging
      console.log('[NextAuth Redirect]', { url, baseUrl })
      
      // If url is a relative path, make it absolute
      if (url.startsWith('/')) {
        const redirectUrl = `${baseUrl}${url}`
        console.log('[NextAuth Redirect] Returning:', redirectUrl)
        return redirectUrl
      }
      // If url is from the same origin, use it
      if (url.startsWith(baseUrl)) {
        console.log('[NextAuth Redirect] Returning:', url)
        return url
      }
      // Default to /peaks if no valid callback URL
      const defaultUrl = `${baseUrl}/peaks`
      console.log('[NextAuth Redirect] Returning default:', defaultUrl)
      return defaultUrl
    },
  },
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  debug: true, // Enable debug logging to troubleshoot magic link issues
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Ensure cookies work in incognito/private browsing
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
}


