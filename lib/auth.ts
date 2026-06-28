import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user || !user.isActive) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        return {
          id: String(user.id),
          name: user.nama,
          email: user.username,
          role: user.role,
          desaKelurahanId: user.desaKelurahanId,
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = Number(user.id)
        token.role = (user as any).role
        token.desaKelurahanId = (user as any).desaKelurahanId
        token.nama = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).desaKelurahanId = token.desaKelurahanId
        ;(session.user as any).nama = token.nama
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
