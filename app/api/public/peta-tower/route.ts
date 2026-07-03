import { prisma } from '@/lib/prisma'
import { successResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'

export async function GET(request: Request) {
  try {
    const params = parseSearchParams(request)

    const where: any = { statusVerifikasi: 'APPROVED' }

    const minLat = params.get('minLat')
    const maxLat = params.get('maxLat')
    const minLng = params.get('minLng')
    const maxLng = params.get('maxLng')
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat), lte: parseFloat(maxLat) }
      where.longitude = { gte: parseFloat(minLng), lte: parseFloat(maxLng) }
    }

    const kecamatanId = params.get('kecamatan_id')
    if (kecamatanId) where.kecamatanId = kecamatanId

    const data = await prisma.tower.findMany({
      where,
      select: {
        id: true,
        namaTower: true,
        latitude: true,
        longitude: true,
        tinggiKategori: true,
        kecamatan: { select: { id: true, nama: true } },
        desaKelurahan: { select: { id: true, nama: true } },
        towerOperator: { include: { operator: { select: { nama: true } } } },
        towerTeknologi: { include: { teknologi: { select: { nama: true } } } },
      },
      take: 5000,
    })

    return successResponse(data, 'Data peta tower berhasil diambil', { total: data.length })
  } catch {
    return serverErrorResponse()
  }
}
