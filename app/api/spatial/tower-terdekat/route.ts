import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const latitude = parseFloat(params.get('latitude') ?? '')
    const longitude = parseFloat(params.get('longitude') ?? '')
    const radiusKm = parseFloat(params.get('radius_km') ?? '10')

    if (isNaN(latitude) || isNaN(longitude)) {
      return errorResponse('Parameter latitude dan longitude wajib diisi')
    }

    const radiusMeter = radiusKm * 1000

    const towers = await prisma.$queryRaw<any[]>`
      SELECT
        t.id,
        t.nama_tower,
        t.latitude,
        t.longitude,
        t.status_verifikasi,
        t.tinggi_kategori,
        ROUND(ST_DistanceSphere(
          ST_MakePoint(t.longitude, t.latitude),
          ST_MakePoint(${longitude}, ${latitude})
        )::numeric, 2) AS jarak_meter,
        k.nama AS kecamatan_nama,
        d.nama AS desa_nama
      FROM tower t
      LEFT JOIN kecamatan k ON k.id = t.kecamatan_id
      LEFT JOIN desa_kelurahan d ON d.id = t.desa_kelurahan_id
      WHERE t.status_verifikasi = 'APPROVED'
        AND ST_DistanceSphere(
          ST_MakePoint(t.longitude, t.latitude),
          ST_MakePoint(${longitude}, ${latitude})
        ) <= ${radiusMeter}
      ORDER BY jarak_meter ASC
      LIMIT 20
    `

    return successResponse(towers, 'Tower terdekat berhasil ditemukan', { radius_km: radiusKm, total: towers.length })
  } catch {
    return serverErrorResponse()
  }
}
