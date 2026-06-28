import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { masterDataSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take, search } = parsePagination(params)

    const where = search ? { nama: { contains: search, mode: 'insensitive' as const } } : {}

    const [data, total] = await Promise.all([
      prisma.operator.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      prisma.operator.count({ where }),
    ])

    return successResponse(data, 'Data operator berhasil diambil', paginationMeta(total, page, pageSize))
  } catch {
    return serverErrorResponse()
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const body = await request.json()
    const parsed = masterDataSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const existing = await prisma.operator.findUnique({ where: { nama: parsed.data.nama.trim() } })
    if (existing) return errorResponse('Operator dengan nama ini sudah ada')

    const data = await prisma.operator.create({ data: { nama: parsed.data.nama.trim() } })
    return createdResponse(data, 'Operator berhasil ditambahkan')
  } catch {
    return serverErrorResponse()
  }
}
