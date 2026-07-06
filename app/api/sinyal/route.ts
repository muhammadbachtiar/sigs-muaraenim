import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { sinyalSchema } from '@/lib/validations'
import { DEFAULT_DATA_MONTHS } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)

    const where: any = {}

    // Tenant isolation: PEMDES hanya lihat data desanya — tidak bisa di-override
    if (user!.role === 'PEMDES' && user!.desaKelurahanId) {
      where.desaKelurahanId = user!.desaKelurahanId
    } else if (user!.role === 'SUPER_ADMIN') {
      // Admin bisa filter by desa atau kecamatan
      const desaId = params.get('desa_id')
      const kecamatanId = params.get('kecamatan_id')
      if (desaId) where.desaKelurahanId = desaId
      if (kecamatanId) where.desaKelurahan = { kecamatanId }
    }

    // Filter operator (bisa multi, comma-separated)
    const operatorIdParam = params.get('operator_id')
    if (operatorIdParam) {
      const ids = operatorIdParam.split(',').filter(Boolean)
      where.operatorId = ids.length === 1 ? ids[0] : { in: ids }
    }

    // Filter teknologi (bisa multi, comma-separated)
    const teknologiIdParam = params.get('teknologi_id')
    if (teknologiIdParam) {
      const ids = teknologiIdParam.split(',').filter(Boolean)
      where.teknologiId = ids.length === 1 ? ids[0] : { in: ids }
    }

    // Filter RSRP range
    const rsrpMin = params.get('rsrp_min')
    const rsrpMax = params.get('rsrp_max')
    if (rsrpMin || rsrpMax) {
      where.rsrp = {}
      if (rsrpMin) where.rsrp.gte = parseFloat(rsrpMin)
      if (rsrpMax) where.rsrp.lte = parseFloat(rsrpMax)
    }

    // Filter tanggal range (manual override 6 bulan)
    const tanggalDari = params.get('tanggal_dari')
    const tanggalSampai = params.get('tanggal_sampai')
    const allTime = params.get('all_time')

    if (tanggalDari || tanggalSampai) {
      where.tanggalPengukuran = {}
      if (tanggalDari) where.tanggalPengukuran.gte = new Date(tanggalDari)
      if (tanggalSampai) where.tanggalPengukuran.lte = new Date(tanggalSampai)
    } else if (!allTime) {
      const defaultDate = new Date()
      defaultDate.setMonth(defaultDate.getMonth() - DEFAULT_DATA_MONTHS)
      where.tanggalPengukuran = { gte: defaultDate }
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

    // Mode peta: skip pagination, return field minimal, max 5000
    if (params.get('for_map') === 'true') {
      const data = await prisma.riwayatSinyal.findMany({
        where,
        select: {
          id: true,
          latitude: true,
          longitude: true,
          rsrp: true,
          tanggalPengukuran: true,
          operator: { select: { id: true, nama: true } },
          teknologi: { select: { id: true, nama: true } },
          desaKelurahan: { select: { id: true, nama: true } },
        },
        take: 5000,
        orderBy: { tanggalPengukuran: 'desc' },
      })
      return successResponse(data, 'Data peta sinyal berhasil diambil', { total: data.length })
    }

    const { page, pageSize, skip, take } = parsePagination(params)

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
