import { prisma } from '@/lib/prisma'
import { successResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { DEFAULT_DATA_MONTHS } from '@/lib/constants'

// Batas data per level filter (agar API tetap ringan)
const LIMIT_KABUPATEN = 5000  // Seluruh kabupaten (tanpa filter wilayah)
const LIMIT_KECAMATAN = 3000  // Filter per kecamatan
const LIMIT_DESA = 1000       // Filter per desa (semua data desa dimuat)

export async function GET(request: Request) {
  try {
    const params = parseSearchParams(request)

    const desaId = params.get('desa_id')
    const kecamatanId = params.get('kecamatan_id')

    // Tentukan batas data berdasarkan level filter aktif
    let dataLimit: number
    if (desaId) {
      dataLimit = LIMIT_DESA
    } else if (kecamatanId) {
      dataLimit = LIMIT_KECAMATAN
    } else {
      dataLimit = LIMIT_KABUPATEN
    }

    const where: any = {}

    // Filter wilayah (opsional — tanpa filter = seluruh kabupaten)
    if (desaId) {
      where.desaKelurahanId = desaId
    } else if (kecamatanId) {
      where.desaKelurahan = { kecamatanId }
    }

    // BBOX filter (opsional — untuk optimasi viewport)
    const minLat = params.get('minLat')
    const maxLat = params.get('maxLat')
    const minLng = params.get('minLng')
    const maxLng = params.get('maxLng')
    if (minLat && maxLat && minLng && maxLng) {
      where.latitude = { gte: parseFloat(minLat), lte: parseFloat(maxLat) }
      where.longitude = { gte: parseFloat(minLng), lte: parseFloat(maxLng) }
    }

    // Operator filter
    const operatorId = params.get('operator_id')
    if (operatorId) {
      const ids = operatorId.split(',').filter(Boolean)
      where.operatorId = ids.length === 1 ? ids[0] : { in: ids }
    }

    // Teknologi filter
    const teknologiId = params.get('teknologi_id')
    if (teknologiId) {
      const ids = teknologiId.split(',').filter(Boolean)
      where.teknologiId = ids.length === 1 ? ids[0] : { in: ids }
    }

    // Tanggal filter — default 6 bulan terakhir (seragam dengan konstanta sistem)
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

    // Hanya ambil field minimum yang dibutuhkan peta (payload ringan)
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
      take: dataLimit,
      orderBy: { tanggalPengukuran: 'desc' },
    })

    return successResponse(data, 'Data peta sinyal berhasil diambil', {
      total: data.length,
      limit: dataLimit,
      level: desaId ? 'desa' : kecamatanId ? 'kecamatan' : 'kabupaten',
      bbox: minLat
        ? {
            minLat: parseFloat(minLat!),
            maxLat: parseFloat(maxLat!),
            minLng: parseFloat(minLng!),
            maxLng: parseFloat(maxLng!),
          }
        : null,
    })
  } catch {
    return serverErrorResponse()
  }
}
