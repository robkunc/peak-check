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
              pass: (process.env.EMAIL_SERVER_PASSWORD || "").trim(), // Ensure no trailing spaces
            },
          },
          from: process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER,
          async sendVerificationRequest({ identifier: email, url, provider, theme }) {
            const { host } = new URL(url)
            // NOTE: You are not required to use `nodemailer`, use whatever you want.
            const { createTransport } = await import('nodemailer')
            const transport = createTransport(provider.server)

            console.log(`[Email Debug] Attempting to send verification email to: ${email}`)
            console.log(`[Email Debug] SMTP Host: ${process.env.EMAIL_SERVER_HOST}`)

            try {
              const result = await transport.sendMail({
                to: email,
                from: provider.from,
                subject: `Sign in to ${host}`,
                text: text({ url, host }),
                html: html({ url, host, theme }),
              })

              const failed = result.rejected.concat(result.pending).filter(Boolean)
              if (failed.length) {
                console.error(`[Email Debug] Failed to send to: ${failed.join(", ")}`)
                throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`)
              }
              console.log(`[Email Debug] Verification email sent successfully to ${email}. MessageId: ${result.messageId}`)
            } catch (error) {
              console.error('[Email Debug] Error sending verification email:', error)
              throw error
            }
          },
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
      try {
        // PrismaAdapter handles user creation automatically
        // Just log for debugging
        console.log('[NextAuth signIn]', {
          email: user.email,
          provider: account?.provider,
          hasAccount: !!account
        })
        return true
      } catch (error) {
        console.error('[NextAuth signIn error]', error)
        // Log detailed error information
        if (error instanceof Error) {
          console.error('[NextAuth signIn error details]', {
            message: error.message,
            stack: error.stack,
            name: error.name,
          })
        }
        // Don't block sign-in, let PrismaAdapter handle it
        return true
      }
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
        // Log specific database connection errors
        if (error instanceof Error) {
          if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout') || error.message.includes('connect')) {
            console.error('[Database Unavailable] Database connection failed. Check if Supabase is up.')
          } else if (error.message.includes('prepared statement')) {
            console.error('[Database Pooler Issue] Using connection pooler instead of direct connection. Update DATABASE_URL to use port 5432.')
          }
        }
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

/**
 * Email HTML body
 * Insert invisible space into domains from being turned into a hyperlink by email
 * clients like Outlook and Apple mail, as this is confusing because it seems
 * like they are supposed to click on it to sign in.
 */
function html(params: { url: string; host: string; theme: any }) {
  const { url, host, theme } = params

  const brandColor = theme.brandColor || "#346df1"
  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: theme.buttonText || "#fff",
  }

  return `
<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${host}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">Sign
                in</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email, you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
`
}

/** Email Text body (fallback for email clients that don't render HTML) */
function text({ url, host }: { url: string; host: string }) {
  return `Sign in to ${host}\n${url}\n\n`
}


