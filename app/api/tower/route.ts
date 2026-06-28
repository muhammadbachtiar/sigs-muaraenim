import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { towerSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take, search } = parsePagination(params)

    const where: any = {}
    // Tower adalah data global — TIDAK ada tenant isolation

    const statusVerifikasi = params.get('status_verifikasi')
    const desaId = params.get('desa_id')
    const kecamatanId = params.get('kecamatan_id')

    if (statusVerifikasi) where.statusVerifikasi = statusVerifikasi
    if (desaId) where.desaKelurahanId = parseInt(desaId, 10)
    if (kecamatanId) where.kecamatanId = parseInt(kecamatanId, 10)
    if (search) where.namaTower = { contains: search, mode: 'insensitive' }

    const [data, total] = await Promise.all([
      prisma.tower.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          kecamatan: { select: { id: true, nama: true } },
          desaKelurahan: { select: { id: true, nama: true } },
          user: { select: { id: true, nama: true } },
          towerOperator: { include: { operator: { select: { id: true, nama: true } } } },
          towerTeknologi: { include: { teknologi: { select: { id: true, nama: true } } } },
          towerMedia: { include: { mediaTransmisi: { select: { id: true, nama: true } } } },
          _count: { select: { foto: true } },
        },
      }),
      prisma.tower.count({ where }),
    ])

    return successResponse(data, 'Data tower berhasil diambil', paginationMeta(total, page, pageSize))
  } catch {
    return serverErrorResponse()
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const parsed = towerSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const { operatorIds, teknologiIds, mediaIds, ...towerData } = parsed.data

    const data = await prisma.tower.create({
      data: {
        ...towerData,
        userId: user!.id,
        statusVerifikasi: user!.role === 'SUPER_ADMIN' ? 'APPROVED' : 'PENDING',
        towerOperator: { create: operatorIds.map((operatorId) => ({ operatorId })) },
        towerTeknologi: { create: teknologiIds.map((teknologiId) => ({ teknologiId })) },
        towerMedia: { create: mediaIds.map((mediaTransmisiId) => ({ mediaTransmisiId })) },
      },
    })

    return createdResponse({ id: data.id, created_at: data.createdAt }, 'Tower berhasil diajukan')
  } catch {
    return serverErrorResponse()
  }
}
