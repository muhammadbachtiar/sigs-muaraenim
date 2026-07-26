import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, serverErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const isPemdes = user!.role === 'PEMDES' && !!user!.desaKelurahanId
    const desaFilter = isPemdes ? { desaKelurahanId: user!.desaKelurahanId! } : {}

    const [recentSinyal, recentTower, recentDemografi] = await Promise.all([
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
        where: isPemdes
          ? { desaKelurahanId: user!.desaKelurahanId! }
          : {},
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, namaTower: true, statusVerifikasi: true, createdAt: true,
          kecamatan: { select: { nama: true } },
          desaKelurahan: { select: { nama: true } },
          user: { select: { nama: true } },
        },
      }),
      // Include demografi updates for PEMDES
      isPemdes
        ? prisma.demografiDesa.findMany({
            where: { desaKelurahanId: user!.desaKelurahanId! },
            take: 5,
            orderBy: { updatedAt: 'desc' },
            select: {
              desaKelurahanId: true,
              updatedAt: true,
              desaKelurahan: { select: { nama: true } },
            },
          })
        : Promise.resolve([]),
    ])

    return successResponse(
      { recentSinyal, recentTower, recentDemografi },
      'Aktivitas terbaru berhasil diambil'
    )
  } catch {
    return serverErrorResponse()
  }
}
