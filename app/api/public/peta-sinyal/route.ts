import { prisma } from '@/lib/prisma'
import { successResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { DEFAULT_DATA_MONTHS } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const params = parseSearchParams(request)

    const where: any = {}

    // BBOX filter (required for peta)
    const minLat = params.get('minLat')
    const maxLat = params.get('maxLat')
    const minLng = params.get('minLng')
    const maxLng = params.get('maxLng')
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat), lte: parseFloat(maxLat) }
      where.longitude = { gte: parseFloat(minLng), lte: parseFloat(maxLng) }
    }

    const operatorId = params.get('operator_id')
    if (operatorId) where.operatorId = parseInt(operatorId, 10)

    // Default 6 bulan terakhir
    const defaultDate = new Date()
    defaultDate.setMonth(defaultDate.getMonth() - DEFAULT_DATA_MONTHS)
    where.tanggalPengukuran = { gte: defaultDate }

    const data = await prisma.riwayatSinyal.findMany({
      where,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        rsrp: true,
        operator: { select: { id: true, nama: true } },
        teknologi: { select: { id: true, nama: true } },
      },
      take: 5000,
    })

    return successResponse(data, 'Data peta sinyal berhasil diambil', {
      total: data.length,
      bbox: minLat ? { minLat: parseFloat(minLat!), maxLat: parseFloat(maxLat!), minLng: parseFloat(minLng!), maxLng: parseFloat(maxLng!) } : null,
    })
  } catch {
    return serverErrorResponse()
  }
}
