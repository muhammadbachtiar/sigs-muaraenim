import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, serverErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const isPemdes = user!.role === 'PEMDES' && user!.desaKelurahanId
    const desaFilter = isPemdes ? { desaKelurahanId: user!.desaKelurahanId! } : {}

    const [totalSinyal, sinyalBaik, sinyalSedang, sinyalBuruk, totalOperator, totalTeknologi, totalDesa] = await Promise.all([
      prisma.riwayatSinyal.count({ where: desaFilter }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { gte: -85 } } }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { lt: -85, gte: -100 } } }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { lt: -100 } } }),
      prisma.operator.count(),
      prisma.teknologi.count(),
      prisma.desaKelurahan.count(),
    ])

    let totalTower = 0
    let towerApproved = 0
    let towerPending = 0
    let towerRejected = 0
    let towersNearby = 0
    let desaLatitude: number | null = null
    let desaLongitude: number | null = null
    let demografiFields: Record<string, any> = {}

    if (isPemdes) {
      const desa = await prisma.desaKelurahan.findUnique({
        where: { id: user!.desaKelurahanId! },
        include: { demografi: true },
      })

      desaLatitude = desa?.latitude ?? null
      desaLongitude = desa?.longitude ?? null

      if (desa?.demografi) {
        demografiFields = {
          jumlahPenduduk: desa.demografi.jumlahPenduduk,
          usiaProduktif: desa.demografi.usiaProduktif,
          kepadatan: desa.demografi.kepadatan,
          rataRataPenghasilan: desa.demografi.rataRataPenghasilan,
          mataPencaharianUtama: desa.demografi.mataPencaharianUtama,
        }
      }

      if (desaLatitude != null && desaLongitude != null) {
        const nearbyResult = await prisma.$queryRawUnsafe<[{ count: number }]>(
          `SELECT COUNT(*)::int as count FROM tower
           WHERE status_verifikasi = 'APPROVED'
             AND ST_DWithin(
               geom,
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               5000
             )`,
          desaLongitude,
          desaLatitude
        )
        towersNearby = nearbyResult[0]?.count ?? 0
      }

      totalTower = towersNearby
      towerApproved = towersNearby
    } else {
      const [tt, ta, tp, tr] = await Promise.all([
        prisma.tower.count(),
        prisma.tower.count({ where: { statusVerifikasi: 'APPROVED' } }),
        prisma.tower.count({ where: { statusVerifikasi: 'PENDING' } }),
        prisma.tower.count({ where: { statusVerifikasi: 'REJECTED' } }),
      ])
      totalTower = tt
      towerApproved = ta
      towerPending = tp
      towerRejected = tr
    }

    return successResponse({
      totalSinyal, sinyalBaik, sinyalSedang, sinyalBuruk,
      totalTower, towerApproved, towerPending, towerRejected,
      totalOperator, totalTeknologi, totalDesa,
      ...(isPemdes ? { towersNearby, desaLatitude, desaLongitude, demografiFields } : {}),
    }, 'Statistik dashboard berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}

