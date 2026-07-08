import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import {
  calculateIdwGrid,
  generateGridPoints,
  IDW_DEFAULTS,
  IDW_GRID_LIMITS,
} from '@/lib/idw'
import type { SignalPoint, IdwParams } from '@/lib/idw'

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    // ─── Parse & Validasi Body ────────────────────────────────────────────
    const body = await request.json().catch(() => null)
    if (!body) return errorResponse('Request body tidak valid atau kosong.')

    const {
      desaKelurahanId,
      kecamatanId,
      operatorId,
      teknologiId,
      p,
      n,
      radius,
      resolutionM,
      bbox,
    } = body

    // Wajib ada salah satu: desaKelurahanId, kecamatanId, atau bbox manual
    if (!desaKelurahanId && !kecamatanId && !bbox) {
      return errorResponse(
        'Wajib menentukan desaKelurahanId, kecamatanId, atau bbox (minLat, maxLat, minLng, maxLng) sebagai area grid.',
      )
    }

    // ─── Resolusi & Parameter IDW ─────────────────────────────────────────
    const resolution =
      typeof resolutionM === 'number' &&
      resolutionM >= IDW_GRID_LIMITS.minResolutionM &&
      resolutionM <= IDW_GRID_LIMITS.maxResolutionM
        ? resolutionM
        : 200 // default 200m

    const params: IdwParams = {
      p: typeof p === 'number' && p > 0 && p <= 10 ? p : IDW_DEFAULTS.p,
      n: typeof n === 'number' && n >= 3 && n <= 50 ? Math.round(n) : IDW_DEFAULTS.n,
      radius:
        typeof radius === 'number' && radius > 0 && radius <= IDW_GRID_LIMITS.maxRadiusKm
          ? radius
          : IDW_DEFAULTS.radius,
    }

    // ─── Tentukan Bounding Box Area Grid ─────────────────────────────────
    let areaBbox = bbox as {
      minLat: number; maxLat: number; minLng: number; maxLng: number
    } | null

    if (!areaBbox && desaKelurahanId) {
      // Hitung bbox dari titik-titik sinyal yang ada di desa ini
      const agg = await prisma.riwayatSinyal.aggregate({
        where: { desaKelurahanId },
        _min: { latitude: true, longitude: true },
        _max: { latitude: true, longitude: true },
      })
      if (
        agg._min.latitude != null &&
        agg._max.latitude != null &&
        agg._min.longitude != null &&
        agg._max.longitude != null
      ) {
        // Tambah margin 0.5km agar sel di pinggir masih dihitung
        const margin = 0.005
        areaBbox = {
          minLat: agg._min.latitude - margin,
          maxLat: agg._max.latitude + margin,
          minLng: agg._min.longitude - margin,
          maxLng: agg._max.longitude + margin,
        }
      }
    }

    if (!areaBbox && kecamatanId) {
      const agg = await prisma.riwayatSinyal.aggregate({
        where: {
          desaKelurahan: { kecamatanId },
        },
        _min: { latitude: true, longitude: true },
        _max: { latitude: true, longitude: true },
      })
      if (
        agg._min.latitude != null &&
        agg._max.latitude != null &&
        agg._min.longitude != null &&
        agg._max.longitude != null
      ) {
        const margin = 0.008
        areaBbox = {
          minLat: agg._min.latitude - margin,
          maxLat: agg._max.latitude + margin,
          minLng: agg._min.longitude - margin,
          maxLng: agg._max.longitude + margin,
        }
      }
    }

    if (!areaBbox) {
      return errorResponse(
        'Tidak dapat menentukan area grid. Pastikan terdapat data sinyal pada wilayah yang dipilih.',
      )
    }

    // ─── Generate Titik Grid ──────────────────────────────────────────────
    const gridPoints = generateGridPoints(areaBbox, resolution)

    if (gridPoints.length === 0) {
      return errorResponse('Area terlalu kecil untuk dibagi menjadi grid.')
    }

    // ─── Ambil Data Historis ──────────────────────────────────────────────
    // Ambil semua titik historis dalam bbox yang diperlebar sebesar radius IDW
    const degPerKm = 1 / 111.32
    const latDelta = (params.radius!) * degPerKm
    const lngDelta = (params.radius!) * degPerKm

    const dataWhere: any = {
      latitude: { gte: areaBbox.minLat - latDelta, lte: areaBbox.maxLat + latDelta },
      longitude: { gte: areaBbox.minLng - lngDelta, lte: areaBbox.maxLng + lngDelta },
      OR: [
        { rsrp: { not: null } },
        { rssi: { not: null } },
      ],
    }

    if (operatorId && typeof operatorId === 'string') dataWhere.operatorId = operatorId
    if (teknologiId && typeof teknologiId === 'string') dataWhere.teknologiId = teknologiId

    const rawData = await prisma.riwayatSinyal.findMany({
      where: dataWhere,
      select: {
        latitude: true,
        longitude: true,
        rsrp: true,
        rssi: true,
        rsrq: true,
        snr: true,
      },
      take: 5000, // ambil max 5000 data historis untuk grid
      orderBy: { tanggalPengukuran: 'desc' },
    })

    if (rawData.length < IDW_DEFAULTS.minNeighbors) {
      return errorResponse(
        `Data historis sinyal di area ini terlalu sedikit (${rawData.length} titik). Tambah data pengukuran terlebih dahulu.`,
        422,
      )
    }

    const dataPoints: SignalPoint[] = rawData.map((d) => ({
      latitude: d.latitude,
      longitude: d.longitude,
      rsrp: d.rsrp,
      rssi: d.rssi,
      rsrq: d.rsrq,
      snr: d.snr,
    }))

    // ─── Hitung IDW Grid ──────────────────────────────────────────────────
    const gridResult = calculateIdwGrid(gridPoints, dataPoints, params)

    // Statistik hasil
    const validCells = gridResult.filter((c) => c.rsrp !== null)
    const emptyCells = gridResult.length - validCells.length
    const avgRsrp =
      validCells.length > 0
        ? validCells.reduce((a, b) => a + (b.rsrp ?? 0), 0) / validCells.length
        : null

    return successResponse(
      {
        bbox: areaBbox,
        params: {
          p: params.p,
          n: params.n,
          radius: params.radius,
          resolutionM: resolution,
        },
        grid: gridResult,
        stats: {
          totalCells: gridResult.length,
          validCells: validCells.length,
          emptyCells,
          historicalDataUsed: rawData.length,
          avgRsrp: avgRsrp !== null ? Math.round(avgRsrp * 10) / 10 : null,
        },
        warning:
          emptyCells > gridResult.length * 0.3
            ? `${emptyCells} dari ${gridResult.length} sel tidak memiliki data cukup di sekitarnya. Tambah radius atau data pengukuran.`
            : null,
      },
      `Grid IDW (${gridResult.length} sel, resolusi ${resolution}m) berhasil dihitung`,
    )
  } catch (err) {
    console.error('[predict-idw-grid]', err)
    return serverErrorResponse()
  }
}
