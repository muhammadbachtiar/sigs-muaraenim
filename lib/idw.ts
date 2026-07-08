/**
 * lib/idw.ts
 * Pure utility functions untuk perhitungan Inverse Distance Weighting (IDW)
 * dan jarak Haversine antar koordinat geografis.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type GeoPoint = {
  latitude: number
  longitude: number
}

export type SignalPoint = GeoPoint & {
  rsrp: number | null
  rssi: number | null
  rsrq: number | null
  snr: number | null
}

export type IdwParams = {
  p?: number    // Power parameter (default: 2)
  n?: number    // Max tetangga terdekat (default: semua dalam radius)
  radius?: number // Radius pencarian dalam KM (default: 5)
}

export type IdwResult = {
  rsrp: number | null
  rssi: number | null
  rsrq: number | null
  snr: number | null
  neighborsUsed: number
  neighborsInRadius: number
  minDistance: number | null // km
  maxDistance: number | null // km
  avgDistance: number | null // km
  warning: string | null
}

export type IdwGridCell = {
  latitude: number
  longitude: number
  rsrp: number | null
  neighborsUsed: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const IDW_DEFAULTS = {
  p: 2,
  n: 20,        // Ambil max 20 tetangga terdekat
  radius: 5.0,  // 5 km
  minNeighbors: 3,
} as const

export const IDW_GRID_LIMITS = {
  maxCells: 2500,
  minResolutionM: 100, // 100 meter per sel minimum
  maxResolutionM: 1000,
  maxRadiusKm: 15,
} as const

// ─── Haversine Distance ───────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371

/**
 * Menghitung jarak geodesik (km) antara dua koordinat menggunakan rumus Haversine.
 * Lebih akurat untuk jarak pendek dibandingkan formula Euclidean.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLng * sinDLng

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

// ─── IDW Core ─────────────────────────────────────────────────────────────────

/**
 * Menghitung prediksi nilai IDW untuk satu metrik tunggal (misal: hanya rsrp)
 * dari sekumpulan pasangan (jarak, nilai).
 *
 * @param neighbors Array pasangan { distance: km, value: angka }
 * @param p Power parameter
 */
function idwSingleMetric(
  neighbors: Array<{ distanceKm: number; value: number }>,
  p: number,
): number | null {
  if (neighbors.length === 0) return null

  // Edge case: titik tepat di atas titik historis
  const exact = neighbors.find((n) => n.distanceKm === 0)
  if (exact) return exact.value

  let numerator = 0
  let denominator = 0

  for (const n of neighbors) {
    const w = 1 / Math.pow(n.distanceKm, p)
    numerator += w * n.value
    denominator += w
  }

  if (denominator === 0) return null
  return numerator / denominator
}

/**
 * Prediksi utama IDW untuk semua metrik sinyal (RSRP, RSSI, RSRQ, SNR).
 *
 * @param target Koordinat titik target yang akan diprediksi
 * @param dataPoints Data historis sinyal
 * @param params Parameter IDW (p, n, radius)
 */
export function calculateIdw(
  target: GeoPoint,
  dataPoints: SignalPoint[],
  params?: IdwParams,
): IdwResult {
  const p = params?.p ?? IDW_DEFAULTS.p
  const n = params?.n ?? IDW_DEFAULTS.n
  const radius = params?.radius ?? IDW_DEFAULTS.radius

  // 1. Hitung jarak ke semua titik historis
  const withDistance = dataPoints.map((pt) => ({
    ...pt,
    distanceKm: haversineKm(target, pt),
  }))

  // 2. Filter berdasarkan radius
  const inRadius = withDistance.filter((pt) => pt.distanceKm <= radius)

  // 3. Urutkan berdasarkan jarak dan ambil N terdekat
  inRadius.sort((a, b) => a.distanceKm - b.distanceKm)
  const neighbors = inRadius.slice(0, n)

  const neighborsUsed = neighbors.length
  const neighborsInRadius = inRadius.length

  // 4. Hitung statistik jarak
  const distances = neighbors.map((n) => n.distanceKm)
  const minDistance = distances.length > 0 ? Math.min(...distances) : null
  const maxDistance = distances.length > 0 ? Math.max(...distances) : null
  const avgDistance =
    distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : null

  // 5. Cek batas minimum
  let warning: string | null = null
  if (neighborsUsed < IDW_DEFAULTS.minNeighbors) {
    warning =
      neighborsUsed === 0
        ? `Tidak ada data pengukuran dalam radius ${radius} km dari titik ini. Coba tambah radius pencarian.`
        : `Hanya ditemukan ${neighborsUsed} titik data dalam radius ${radius} km (minimum: ${IDW_DEFAULTS.minNeighbors}). Hasil estimasi kurang akurat.`
  }

  // 6. Hitung IDW per metrik
  const rsrpNeighbors = neighbors
    .filter((n) => n.rsrp !== null)
    .map((n) => ({ distanceKm: n.distanceKm, value: n.rsrp as number }))

  const rssiNeighbors = neighbors
    .filter((n) => n.rssi !== null)
    .map((n) => ({ distanceKm: n.distanceKm, value: n.rssi as number }))

  const rsrqNeighbors = neighbors
    .filter((n) => n.rsrq !== null)
    .map((n) => ({ distanceKm: n.distanceKm, value: n.rsrq as number }))

  const snrNeighbors = neighbors
    .filter((n) => n.snr !== null)
    .map((n) => ({ distanceKm: n.distanceKm, value: n.snr as number }))

  return {
    rsrp: idwSingleMetric(rsrpNeighbors, p),
    rssi: idwSingleMetric(rssiNeighbors, p),
    rsrq: idwSingleMetric(rsrqNeighbors, p),
    snr: idwSingleMetric(snrNeighbors, p),
    neighborsUsed,
    neighborsInRadius,
    minDistance: minDistance !== null ? Math.round(minDistance * 1000) / 1000 : null,
    maxDistance: maxDistance !== null ? Math.round(maxDistance * 1000) / 1000 : null,
    avgDistance: avgDistance !== null ? Math.round(avgDistance * 1000) / 1000 : null,
    warning,
  }
}

// ─── Grid Generation ─────────────────────────────────────────────────────────

/**
 * Menghasilkan titik-titik pusat grid dalam bounding box tertentu.
 * Resolusi dalam meter; grid dibatasi max IDW_GRID_LIMITS.maxCells sel.
 *
 * @returns Array koordinat titik pusat sel grid
 */
export function generateGridPoints(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  resolutionM = 200,
): GeoPoint[] {
  // Clamp resolusi ke batasan yang ditentukan
  const clampedRes = Math.max(
    IDW_GRID_LIMITS.minResolutionM,
    Math.min(IDW_GRID_LIMITS.maxResolutionM, resolutionM),
  )

  // Konversi resolusi meter ke derajat (aproksimasi untuk lintang rendah)
  const latDeg = clampedRes / 111_320
  const lngDeg = clampedRes / (111_320 * Math.cos((bbox.minLat * Math.PI) / 180))

  const points: GeoPoint[] = []

  let lat = bbox.minLat + latDeg / 2
  while (lat <= bbox.maxLat) {
    let lng = bbox.minLng + lngDeg / 2
    while (lng <= bbox.maxLng) {
      points.push({ latitude: lat, longitude: lng })
      lng += lngDeg
    }
    lat += latDeg
  }

  // Batasi jumlah sel maksimum
  if (points.length > IDW_GRID_LIMITS.maxCells) {
    return points.slice(0, IDW_GRID_LIMITS.maxCells)
  }

  return points
}

/**
 * Menghitung IDW untuk seluruh sel grid secara batch.
 * Hanya mengembalikan RSRP untuk efisiensi visualisasi grid.
 */
export function calculateIdwGrid(
  gridPoints: GeoPoint[],
  dataPoints: SignalPoint[],
  params?: IdwParams,
): IdwGridCell[] {
  return gridPoints.map((cell) => {
    const result = calculateIdw(cell, dataPoints, params)
    return {
      latitude: cell.latitude,
      longitude: cell.longitude,
      rsrp: result.rsrp !== null ? Math.round(result.rsrp * 10) / 10 : null,
      neighborsUsed: result.neighborsUsed,
    }
  })
}
