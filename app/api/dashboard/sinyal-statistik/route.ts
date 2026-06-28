import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, serverErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const desaFilter = user!.role === 'PEMDES' && user!.desaKelurahanId ? { desaKelurahanId: user!.desaKelurahanId } : {}

    const [totalSinyal, sinyalBaik, sinyalSedang, sinyalBuruk, totalTower, towerApproved, towerPending, towerRejected, totalOperator, totalTeknologi, totalDesa] = await Promise.all([
      prisma.riwayatSinyal.count({ where: desaFilter }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { gte: -85 } } }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { lt: -85, gte: -100 } } }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { lt: -100 } } }),
      prisma.tower.count(),
      prisma.tower.count({ where: { statusVerifikasi: 'APPROVED' } }),
      prisma.tower.count({ where: { statusVerifikasi: 'PENDING' } }),
      prisma.tower.count({ where: { statusVerifikasi: 'REJECTED' } }),
      prisma.operator.count(),
      prisma.teknologi.count(),
      prisma.desaKelurahan.count(),
    ])

    return successResponse({
      totalSinyal, sinyalBaik, sinyalSedang, sinyalBuruk,
      totalTower, towerApproved, towerPending, towerRejected,
      totalOperator, totalTeknologi, totalDesa,
    }, 'Statistik dashboard berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}
