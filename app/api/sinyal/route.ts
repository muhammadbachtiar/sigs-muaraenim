import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { sinyalSchema } from '@/lib/validations'
import { DEFAULT_DATA_MONTHS } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take } = parsePagination(params)

    const where: any = {}

    // Tenant isolation: PEMDES hanya lihat data desanya
    if (user!.role === 'PEMDES' && user!.desaKelurahanId) {
      where.desaKelurahanId = user!.desaKelurahanId
    }

    // Filters
    const desaId = params.get('desa_id')
    const kecamatanId = params.get('kecamatan_id')
    const operatorId = params.get('operator_id')
    const rsrpMin = params.get('rsrp_min')
    const rsrpMax = params.get('rsrp_max')

    if (desaId) where.desaKelurahanId = parseInt(desaId, 10)
    if (kecamatanId) where.desaKelurahan = { kecamatanId: parseInt(kecamatanId, 10) }
    if (operatorId) where.operatorId = parseInt(operatorId, 10)
    if (rsrpMin || rsrpMax) {
      where.rsrp = {}
      if (rsrpMin) where.rsrp.gte = parseFloat(rsrpMin)
      if (rsrpMax) where.rsrp.lte = parseFloat(rsrpMax)
    }

    // BBOX filter
    const minLat = params.get('minLat')
    const maxLat = params.get('maxLat')
    const minLng = params.get('minLng')
    const maxLng = params.get('maxLng')
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat), lte: parseFloat(maxLat) }
      where.longitude = { gte: parseFloat(minLng), lte: parseFloat(maxLng) }
    }

    // Default: 6 bulan terakhir
    const defaultDate = new Date()
    defaultDate.setMonth(defaultDate.getMonth() - DEFAULT_DATA_MONTHS)
    if (!params.get('all_time')) {
      where.tanggalPengukuran = { gte: defaultDate }
    }

    const [data, total] = await Promise.all([
      prisma.riwayatSinyal.findMany({
        where,
        skip,
        take,
        orderBy: { tanggalPengukuran: 'desc' },
        include: {
          operator: { select: { id: true, nama: true } },
          teknologi: { select: { id: true, nama: true } },
          desaKelurahan: { select: { id: true, nama: true, kecamatan: { select: { id: true, nama: true } } } },
          user: { select: { id: true, nama: true } },
          foto: { select: { id: true, url: true, keterangan: true } },
        },
      }),
      prisma.riwayatSinyal.count({ where }),
    ])

    return successResponse(data, 'Data sinyal berhasil diambil', paginationMeta(total, page, pageSize))
  } catch {
    return serverErrorResponse()
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const parsed = sinyalSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    // PEMDES hanya bisa input untuk desanya
    if (user!.role === 'PEMDES' && user!.desaKelurahanId && parsed.data.desaKelurahanId !== user!.desaKelurahanId) {
      return errorResponse('Anda hanya dapat menginput data untuk desa Anda')
    }

    const data = await prisma.riwayatSinyal.create({
      data: {
        ...parsed.data,
        tanggalPengukuran: new Date(parsed.data.tanggalPengukuran),
        userId: user!.id,
      },
    })

    return createdResponse({ id: data.id, created_at: data.createdAt }, 'Data sinyal berhasil disimpan')
  } catch {
    return serverErrorResponse()
  }
}
