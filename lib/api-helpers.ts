import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ─── Types ───

export type ApiUser = {
  id: number
  role: 'SUPER_ADMIN' | 'PEMDES'
  nama: string
  desaKelurahanId: number | null
}

type ApiResponseOptions = {
  success: boolean
  message: string
  data?: unknown
  meta?: Record<string, unknown>
  status?: number
}

// ─── JSON Response Helper ───

export function jsonResponse({ success, message, data, meta, status }: ApiResponseOptions) {
  return NextResponse.json(
    { success, message, data: data ?? null, meta: meta ?? null },
    { status: status ?? (success ? 200 : 400) }
  )
}

export function successResponse(data: unknown, message = 'Berhasil', meta?: Record<string, unknown>) {
  return jsonResponse({ success: true, message, data, meta })
}

export function createdResponse(data: unknown, message = 'Data berhasil ditambahkan') {
  return jsonResponse({ success: true, message, data, status: 201 })
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ success: false, message, status })
}

export function notFoundResponse(message = 'Data tidak ditemukan') {
  return errorResponse(message, 404)
}

export function unauthorizedResponse(message = 'Anda belum login') {
  return errorResponse(message, 401)
}

export function forbiddenResponse(message = 'Anda tidak memiliki akses') {
  return errorResponse(message, 403)
}

export function serverErrorResponse(message = 'Terjadi kesalahan server') {
  return errorResponse(message, 500)
}

// ─── Auth Guard ───

export async function getAuthSession(): Promise<ApiUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as any
  return {
    id: user.id,
    role: user.role,
    nama: user.nama,
    desaKelurahanId: user.desaKelurahanId ?? null,
  }
}

export async function requireAuth(allowedRoles?: Array<'SUPER_ADMIN' | 'PEMDES'>) {
  const user = await getAuthSession()
  if (!user) return { user: null, error: unauthorizedResponse() }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { user: null, error: forbiddenResponse() }
  }
  return { user, error: null }
}

// ─── Pagination ───

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') ?? '10', 10) || 10))
  const search = searchParams.get('search')?.trim() || undefined
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, search }
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  }
}

// ─── Search Params Parser ───

export function parseSearchParams(request: Request) {
  return new URL(request.url).searchParams
}

// ─── ID Parser (for dynamic routes) ───

export function parseId(id: string): number | null {
  const parsed = parseInt(id, 10)
  return isNaN(parsed) ? null : parsed
}
