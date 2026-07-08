import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import { calculateIdw, IDW_DEFAULTS } from '@/lib/idw'
import type { SignalPoint, IdwParams } from '@/lib/idw'

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    // ─── Parse & Validasi Body ────────────────────────────────────────────
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Request body tidak valid atau kosong.')

    const { latitude, longitude, operatorId, teknologiId, p, n, radius } = body

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return errorResponse('Parameter latitude dan longitude wajib diisi dan bertipe number.')
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return errorResponse('Nilai latitude atau longitude tidak valid.')
    }

    // Sanitasi parameter IDW
    const params: IdwParams = {
      p: typeof p === 'number' && p > 0 && p <= 10 ? p : IDW_DEFAULTS.p,
      n: typeof n === 'number' && n >= 3 && n <= 50 ? Math.round(n) : IDW_DEFAULTS.n,
      radius:
        typeof radius === 'number' && radius > 0 && radius <= 15 ? radius : IDW_DEFAULTS.radius,
    }

    // ─── Ambil Data Historis dari DB ──────────────────────────────────────
    // Bounding box kasar berdasarkan radius (derajat aproksimasi)
    // untuk membatasi query sebelum filter Haversine
    const degPerKm = 1 / 111.32
    const latDelta = (params.radius!) * degPerKm
    const lngDelta = (params.radius!) * degPerKm / Math.cos((latitude * Math.PI) / 180)

    const where: any = {
      latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
      longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta },
    }

    // Filter operator & teknologi (opsional)
    if (operatorId && typeof operatorId === 'string') where.operatorId = operatorId
    if (teknologiId && typeof teknologiId === 'string') where.teknologiId = teknologiId

    // Pemdes: tidak perlu batasi desa (boleh ambil data di luar desa asal masih dalam radius IDW)
    // Tapi kita hanya ambil data yang valid (ada setidaknya satu nilai sinyal)
    where.OR = [
      { rsrp: { not: null } },
      { rssi: { not: null } },
      { rsrq: { not: null } },
      { snr: { not: null } },
    ]

    const rawData = await prisma.riwayatSinyal.findMany({
      where,
      select: {
        latitude: true,
        longitude: true,
        rsrp: true,
        rssi: true,
        rsrq: true,
        snr: true,
      },
      // Ambil maksimal 1000 data dari bbox — IDW akan memilih N terdekat
      take: 1000,
      orderBy: { tanggalPengukuran: 'desc' },
    })

    const dataPoints: SignalPoint[] = rawData.map((d) => ({
      latitude: d.latitude,
      longitude: d.longitude,
      rsrp: d.rsrp,
      rssi: d.rssi,
      rsrq: d.rsrq,
      snr: d.snr,
    }))

    // ─── Hitung IDW ────────────────────────────────────────────────────────
    const result = calculateIdw({ latitude, longitude }, dataPoints, params)

    // ─── Response ─────────────────────────────────────────────────────────
    return successResponse(
      {
        target: { latitude, longitude },
        params: {
          p: params.p,
          n: params.n,
          radius: params.radius,
          unit: 'km',
        },
        predictions: {
          rsrp: result.rsrp !== null ? Math.round(result.rsrp * 100) / 100 : null,
          rssi: result.rssi !== null ? Math.round(result.rssi * 100) / 100 : null,
          rsrq: result.rsrq !== null ? Math.round(result.rsrq * 100) / 100 : null,
          snr: result.snr !== null ? Math.round(result.snr * 100) / 100 : null,
        },
        stats: {
          neighborsUsed: result.neighborsUsed,
          neighborsInRadius: result.neighborsInRadius,
          totalDataInBbox: rawData.length,
          distanceKm: {
            min: result.minDistance,
            max: result.maxDistance,
            avg: result.avgDistance,
          },
        },
        warning: result.warning,
      },
      'Prediksi IDW berhasil dihitung',
    )
  } catch (err) {
    console.error('[predict-idw]', err)
    return serverErrorResponse()
  }
}
