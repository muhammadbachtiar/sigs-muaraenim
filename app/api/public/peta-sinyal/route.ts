import { prisma } from '@/lib/prisma'
import { successResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { DEFAULT_DATA_MONTHS } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const params = parseSearchParams(request)

    const desaId = params.get('desa_id')
    const kecamatanId = params.get('kecamatan_id')

    // Peta publik wajib pilih Kecamatan & Desa terlebih dahulu
    if (!desaId) {
      return successResponse([], 'Pilih kecamatan dan desa untuk menampilkan data sinyal publik', { total: 0 })
    }

    const where: any = {
      desaKelurahanId: desaId,
    }

    if (kecamatanId) {
      where.desaKelurahan = { kecamatanId }
    }

    // BBOX filter (optional)
    const minLat = params.get('minLat')
    const maxLat = params.get('maxLat')
    const minLng = params.get('minLng')
    const maxLng = params.get('maxLng')
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat), lte: parseFloat(maxLat) }
      where.longitude = { gte: parseFloat(minLng), lte: parseFloat(maxLng) }
    }

    // Operator & Teknologi filter
    const operatorId = params.get('operator_id')
    if (operatorId) {
      const ids = operatorId.split(',').filter(Boolean)
      where.operatorId = ids.length === 1 ? ids[0] : { in: ids }
    }

    const teknologiId = params.get('teknologi_id')
    if (teknologiId) {
      const ids = teknologiId.split(',').filter(Boolean)
      where.teknologiId = ids.length === 1 ? ids[0] : { in: ids }
    }

    // Tanggal filter (default 6 bulan)
    const tanggalDari = params.get('tanggal_dari')
    const tanggalSampai = params.get('tanggal_sampai')
    if (tanggalDari || tanggalSampai) {
      where.tanggalPengukuran = {}
      if (tanggalDari) where.tanggalPengukuran.gte = new Date(tanggalDari)
      if (tanggalSampai) where.tanggalPengukuran.lte = new Date(tanggalSampai)
    } else {
      const defaultDate = new Date()
      defaultDate.setMonth(defaultDate.getMonth() - DEFAULT_DATA_MONTHS)
      where.tanggalPengukuran = { gte: defaultDate }
    }

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

    return successResponse(data, 'Data peta sinyal berhasil diambil', {
      total: data.length,
      bbox: minLat ? { minLat: parseFloat(minLat!), maxLat: parseFloat(maxLat!), minLng: parseFloat(minLng!), maxLng: parseFloat(maxLng!) } : null,
    })
  } catch {
    return serverErrorResponse()
  }
}
