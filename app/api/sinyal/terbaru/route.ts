import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { DEFAULT_DATA_MONTHS } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const limit = Math.min(100, parseInt(params.get('limit') ?? '50', 10) || 50)

    const where: any = {}

    // Tenant isolation
    if (user!.role === 'PEMDES' && user!.desaKelurahanId) {
      where.desaKelurahanId = user!.desaKelurahanId
    }

    const desaId = params.get('desa_id')
    const kecamatanId = params.get('kecamatan_id')
    const operatorId = params.get('operator_id')

    if (desaId) where.desaKelurahanId = parseInt(desaId, 10)
    if (kecamatanId) where.desaKelurahan = { kecamatanId: parseInt(kecamatanId, 10) }
    if (operatorId) where.operatorId = parseInt(operatorId, 10)

    // BBOX
    const minLat = params.get('minLat')
    const maxLat = params.get('maxLat')
    const minLng = params.get('minLng')
    const maxLng = params.get('maxLng')
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat), lte: parseFloat(maxLat) }
      where.longitude = { gte: parseFloat(minLng), lte: parseFloat(maxLng) }
    }

    // Default 6 bulan terakhir
    const defaultDate = new Date()
    defaultDate.setMonth(defaultDate.getMonth() - DEFAULT_DATA_MONTHS)
    where.tanggalPengukuran = { gte: defaultDate }

    const data = await prisma.riwayatSinyal.findMany({
      where,
      take: limit,
      orderBy: { tanggalPengukuran: 'desc' },
      distinct: ['latitude', 'longitude'],
      select: {
        id: true,
        latitude: true,
        longitude: true,
        rsrp: true,
        tanggalPengukuran: true,
        operator: { select: { id: true, nama: true } },
        teknologi: { select: { id: true, nama: true } },
      },
    })

    return successResponse(data, 'Data sinyal terbaru berhasil diambil', { total: data.length })
  } catch {
    return serverErrorResponse()
  }
}
