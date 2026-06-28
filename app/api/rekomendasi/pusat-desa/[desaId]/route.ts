import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ desaId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { desaId: idStr } = await params
    const desaId = parseId(idStr)
    if (!desaId) return errorResponse('ID desa tidak valid')

    const desa = await prisma.desaKelurahan.findUnique({ where: { id: desaId }, select: { id: true, nama: true, latitude: true, longitude: true } })
    if (!desa) return notFoundResponse('Desa tidak ditemukan')

    // Hitung centroid dari titik sinyal di desa ini
    const centroid = await prisma.$queryRaw<[{ avg_lat: number; avg_lng: number; total_titik: number }]>`
      SELECT
        AVG(latitude) AS avg_lat,
        AVG(longitude) AS avg_lng,
        COUNT(*) AS total_titik
      FROM riwayat_sinyal
      WHERE desa_kelurahan_id = ${desaId}
    `

    // Tower terdekat dari centroid
    const avgLat = centroid[0]?.avg_lat
    const avgLng = centroid[0]?.avg_lng

    let towerTerdekat = null
    if (avgLat && avgLng) {
      const towers = await prisma.$queryRaw<any[]>`
        SELECT
          t.id,
          t.nama_tower,
          t.latitude,
          t.longitude,
          ROUND(ST_DistanceSphere(
            ST_MakePoint(t.longitude, t.latitude),
            ST_MakePoint(${avgLng}, ${avgLat})
          )::numeric, 2) AS jarak_meter
        FROM tower t
        WHERE t.status_verifikasi = 'APPROVED'
        ORDER BY jarak_meter ASC
        LIMIT 3
      `
      towerTerdekat = towers
    }

    return successResponse({
      desa,
      centroid: avgLat ? { latitude: Number(avgLat), longitude: Number(avgLng), total_titik: Number(centroid[0].total_titik) } : null,
      towerTerdekat,
    }, 'Rekomendasi pusat desa berhasil dihitung')
  } catch {
    return serverErrorResponse()
  }
}
