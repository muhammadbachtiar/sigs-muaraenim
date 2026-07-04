import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { masterDataSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const isSelect = params.get('is_select') === 'true'
    if (isSelect) {
      const data = await prisma.teknologi.findMany({
        orderBy: { nama: 'asc' },
        select: { id: true, nama: true }
      })
      return successResponse(data, 'Data teknologi untuk select berhasil diambil')
    }

    const { page, pageSize, skip, take, search } = parsePagination(params)

    const where = search ? { nama: { contains: search, mode: 'insensitive' as const } } : {}

    const [data, total] = await Promise.all([
      prisma.teknologi.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      prisma.teknologi.count({ where }),
    ])

    return successResponse(data, 'Data teknologi berhasil diambil', paginationMeta(total, page, pageSize))
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

    const existing = await prisma.teknologi.findUnique({ where: { nama: parsed.data.nama.trim() } })
    if (existing) return errorResponse('Teknologi dengan nama ini sudah ada')

    const data = await prisma.teknologi.create({ data: { nama: parsed.data.nama.trim() } })
    return createdResponse(data, 'Teknologi berhasil ditambahkan')
  } catch {
    return serverErrorResponse()
  }
}
