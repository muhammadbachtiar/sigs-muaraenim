import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const publicPaths = ['/login', '/peta', '/api/public', '/api/auth', '/docs', '/openapi.json']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = publicPaths.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Anda belum login', data: null, meta: null },
        { status: 401 }
      )
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-only API routes protection
  const adminOnlyPaths = ['/api/admin']
  if (adminOnlyPaths.some((p) => pathname.startsWith(p)) && token.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, message: 'Anda tidak memiliki akses', data: null, meta: null },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
