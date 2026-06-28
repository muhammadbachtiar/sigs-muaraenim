import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, serverErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const desaFilter = user!.role === 'PEMDES' && user!.desaKelurahanId ? { desaKelurahanId: user!.desaKelurahanId } : {}

    const [recentSinyal, recentTower] = await Promise.all([
      prisma.riwayatSinyal.findMany({
        where: desaFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, latitude: true, longitude: true, rsrp: true, createdAt: true,
          operator: { select: { nama: true } },
          desaKelurahan: { select: { nama: true } },
          user: { select: { nama: true } },
        },
      }),
      prisma.tower.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, namaTower: true, statusVerifikasi: true, createdAt: true,
          kecamatan: { select: { nama: true } },
          user: { select: { nama: true } },
        },
      }),
    ])

    return successResponse({ recentSinyal, recentTower }, 'Aktivitas terbaru berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}
