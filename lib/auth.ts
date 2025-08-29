import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { Provider } from 'next-auth/providers/index'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

// Microsoft provider configuration
const MicrosoftProvider: Provider = {
  id: 'microsoft',
  name: 'Microsoft',
  type: 'oauth',
  wellKnown: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
  authorization: {
    params: {
      scope: 'openid email profile User.Read',
    },
  },
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    }
  },
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftProvider,
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.name = user.name
      }
      // If token exists but no user data, fetch from database
      if (token.email && !token.name) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { name: true, role: true }
        })
        if (dbUser) {
          token.name = dbUser.name
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        // Ensure name is properly mapped from token
        if (token.name) {
          session.user.name = token.name as string
        }
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // For OAuth providers, create user profile if it doesn't exist
      if (account?.provider !== 'credentials' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email }
        })

        if (!existingUser) {
          // Create new user with default role
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || '',
              role: 'INTERVIEWEE', // Default role
            }
          })
        }
      }
      return true
    }
  },
  pages: {
    signIn: '/auth/signin',
  }
}

declare module 'next-auth' {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
    }
  }
}
