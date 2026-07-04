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
      const data = await prisma.mediaTransmisi.findMany({
        orderBy: { nama: 'asc' },
        select: { id: true, nama: true }
      })
      return successResponse(data, 'Data media transmisi untuk select berhasil diambil')
    }

    const { page, pageSize, skip, take, search } = parsePagination(params)

    const where = search ? { nama: { contains: search, mode: 'insensitive' as const } } : {}

    const [data, total] = await Promise.all([
      prisma.mediaTransmisi.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      prisma.mediaTransmisi.count({ where }),
    ])

    return successResponse(data, 'Data media transmisi berhasil diambil', paginationMeta(total, page, pageSize))
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

    const existing = await prisma.mediaTransmisi.findUnique({ where: { nama: parsed.data.nama.trim() } })
    if (existing) return errorResponse('Media transmisi dengan nama ini sudah ada')

    const data = await prisma.mediaTransmisi.create({ data: { nama: parsed.data.nama.trim() } })
    return createdResponse(data, 'Media transmisi berhasil ditambahkan')
  } catch {
    return serverErrorResponse()
  }
}
