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
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { gt: -85 } } }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { lte: -85, gte: -99 } } }),
      prisma.riwayatSinyal.count({ where: { ...desaFilter, rsrp: { lt: -99 } } }),
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
    let byKecamatan: any[] | undefined = undefined

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
        try {
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
          towersNearby = Number(nearbyResult[0]?.count ?? 0)
        } catch {
          towersNearby = 0
        }
      }

      totalTower = towersNearby
      towerApproved = towersNearby
    } else {
      // SUPER_ADMIN: global counts + per-kecamatan breakdown
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

      // Native Prisma queries for kecamatan breakdown (safe, no raw SQL array casting issues)
      const [kecamatanList, sinyalList, towerGroup] = await Promise.all([
        prisma.kecamatan.findMany({
          select: {
            id: true,
            nama: true,
            _count: {
              select: { tower: true, desaKelurahan: true },
            },
            desaKelurahan: {
              select: { id: true },
            },
          },
          orderBy: { nama: 'asc' },
        }),
        prisma.riwayatSinyal.findMany({
          select: {
            rsrp: true,
            desaKelurahan: {
              select: { kecamatanId: true },
            },
          },
        }),
        prisma.tower.groupBy({
          by: ['kecamatanId', 'statusVerifikasi'],
          _count: { id: true },
        }),
      ])

      // Map kecamatanId -> desaIds
      const kecDesaMap = new Map<string, Set<string>>()
      kecamatanList.forEach(k => {
        kecDesaMap.set(k.id, new Set(k.desaKelurahan.map(d => d.id)))
      })

      // Aggregate sinyal quality per kecamatan
      const sinyalKecMap = new Map<string, { total: number; baik: number; sedang: number; buruk: number }>()
      sinyalList.forEach(s => {
        const kecId = s.desaKelurahan?.kecamatanId
        if (!kecId) return
        let stat = sinyalKecMap.get(kecId)
        if (!stat) {
          stat = { total: 0, baik: 0, sedang: 0, buruk: 0 }
          sinyalKecMap.set(kecId, stat)
        }
        stat.total += 1
        const r = s.rsrp
        if (r != null) {
          if (r > -85) stat.baik += 1
          else if (r >= -99) stat.sedang += 1
          else stat.buruk += 1
        }
      })

      // Aggregate tower status per kecamatan
      const towerKecMap = new Map<string, { approved: number; pending: number; rejected: number }>()
      towerGroup.forEach(tg => {
        let stat = towerKecMap.get(tg.kecamatanId)
        if (!stat) {
          stat = { approved: 0, pending: 0, rejected: 0 }
          towerKecMap.set(tg.kecamatanId, stat)
        }
        const count = tg._count.id
        if (tg.statusVerifikasi === 'APPROVED') stat.approved += count
        else if (tg.statusVerifikasi === 'PENDING') stat.pending += count
        else if (tg.statusVerifikasi === 'REJECTED') stat.rejected += count
      })

      byKecamatan = kecamatanList.map(k => {
        const sinyal = sinyalKecMap.get(k.id) || { total: 0, baik: 0, sedang: 0, buruk: 0 }
        const tower = towerKecMap.get(k.id) || { approved: 0, pending: 0, rejected: 0 }
        const totalTowerKec = k._count.tower

        return {
          id: k.id,
          nama: k.nama,
          jumlahDesa: k._count.desaKelurahan,
          sinyal,
          tower: {
            total: totalTowerKec,
            approved: tower.approved,
            pending: tower.pending,
            rejected: tower.rejected,
          },
        }
      })
    }

    return successResponse({
      totalSinyal, sinyalBaik, sinyalSedang, sinyalBuruk,
      totalTower, towerApproved, towerPending, towerRejected,
      totalOperator, totalTeknologi, totalDesa,
      ...(isPemdes ? { towersNearby, desaLatitude, desaLongitude, demografiFields } : {}),
      ...(byKecamatan ? { byKecamatan } : {}),
    }, 'Statistik dashboard berhasil diambil')
  } catch (err) {
    console.error('Error in GET /api/dashboard/sinyal-statistik:', err)
    return serverErrorResponse()
  }
}
