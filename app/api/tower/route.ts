import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { towerSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take, search } = parsePagination(params)

    const statusVerifikasi = params.get('status_verifikasi')
    const desaId = params.get('desa_id')
    const kecamatanId = params.get('kecamatan_id')

    const whereBase: any = {}
    if (desaId) whereBase.desaKelurahanId = desaId
    if (kecamatanId) whereBase.kecamatanId = kecamatanId
    if (search) whereBase.namaTower = { contains: search, mode: 'insensitive' }

    const where: any = { ...whereBase }
    if (statusVerifikasi) where.statusVerifikasi = statusVerifikasi

    // Mode peta: skip pagination, return field minimal, max 5000 (hanya APPROVED kecuali diminta spesifik)
    if (params.get('for_map') === 'true') {
      const mapWhere = { ...whereBase, statusVerifikasi: statusVerifikasi || 'APPROVED' }
      const data = await prisma.tower.findMany({
        where: mapWhere,
        select: {
          id: true,
          namaTower: true,
          latitude: true,
          longitude: true,
          tinggiKategori: true,
          kecamatan: { select: { id: true, nama: true } },
          desaKelurahan: { select: { id: true, nama: true } },
          towerOperator: { include: { operator: { select: { id: true, nama: true } } } },
          towerTeknologi: { include: { teknologi: { select: { id: true, nama: true } } } },
        },
        take: 5000,
      })
      return successResponse(data, 'Data peta tower berhasil diambil', { total: data.length })
    }

    const [data, totalFiltered, totalAll, totalPending, totalApproved, totalRejected] = await Promise.all([
      prisma.tower.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          kecamatan: { select: { id: true, nama: true } },
          desaKelurahan: { select: { id: true, nama: true } },
          user: { select: { id: true, nama: true, role: true } },
          towerOperator: { include: { operator: { select: { id: true, nama: true } } } },
          towerTeknologi: { include: { teknologi: { select: { id: true, nama: true } } } },
          towerMedia: { include: { mediaTransmisi: { select: { id: true, nama: true } } } },
          _count: { select: { foto: true } },
        },
      }),
      prisma.tower.count({ where }),
      prisma.tower.count({ where: whereBase }),
      prisma.tower.count({ where: { ...whereBase, statusVerifikasi: 'PENDING' } }),
      prisma.tower.count({ where: { ...whereBase, statusVerifikasi: 'APPROVED' } }),
      prisma.tower.count({ where: { ...whereBase, statusVerifikasi: 'REJECTED' } }),
    ])

    return successResponse(data, 'Data tower berhasil diambil', {
      ...paginationMeta(totalFiltered, page, pageSize),
      totalAll,
      totalPending,
      totalApproved,
      totalRejected,
    })
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
