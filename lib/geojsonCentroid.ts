/**
 * lib/geojsonCentroid.ts
 * Helper untuk menghitung titik pusat (centroid) sementara dari GeoJSON
 * batas wilayah desa jika koordinat resmi di database bernilai null.
 */

type GeoJsonFeature = {
  type: string
  properties: {
    kel_desa: string
    kecamatan: string
    kode_kd: string
    nama: string
    [key: string]: any
  }
  geometry: {
    type: string
    coordinates: number[][][][] | number[][][]
  }
}

type GeoJsonCollection = {
  type: string
  features: GeoJsonFeature[]
}

export type DesaCentroid = {
  latitude: number
  longitude: number
  desaNama: string
  kecamatanNama: string
  kodeDesa: string
}

// ─── Cache GeoJSON ────────────────────────────────────────────────────────────

let cachedCollection: GeoJsonCollection | null = null

async function loadGeoJson(): Promise<GeoJsonCollection> {
  if (cachedCollection) return cachedCollection

  const res = await fetch('/data/muara-enim-desa.geojson')
  if (!res.ok) throw new Error('Gagal memuat data batas wilayah desa')

  cachedCollection = (await res.json()) as GeoJsonCollection
  return cachedCollection
}

// ─── Centroid Calculation ─────────────────────────────────────────────────────

/**
 * Menghitung centroid kasar (bounding box center) dari koordinat polygon.
 * Menggunakan metode rata-rata min/max (bounding box center) yang cepat.
 */
function calculateBboxCenter(coordinates: number[][]): { lat: number; lng: number } {
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  for (const coord of coordinates) {
    const lng = coord[0]
    const lat = coord[1]
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  }
}

/**
 * Mengekstrak semua koordinat vertex dari geometry Polygon atau MultiPolygon.
 */
function extractAllCoords(geometry: GeoJsonFeature['geometry']): number[][] {
  const allCoords: number[][] = []

  if (geometry.type === 'Polygon') {
    // coordinates: number[][][] → [ ring1, ring2, ... ]
    const rings = geometry.coordinates as number[][][]
    for (const ring of rings) {
      for (const coord of ring) {
        allCoords.push(coord)
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    // coordinates: number[][][][] → [ polygon1, polygon2, ... ]
    const polygons = geometry.coordinates as number[][][][]
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const coord of ring) {
          allCoords.push(coord)
        }
      }
    }
  }

  return allCoords
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mencari centroid desa berdasarkan nama desa dan nama kecamatan.
 * Cocokkan secara case-insensitive.
 */
export async function findDesaCentroid(
  desaNama: string,
  kecamatanNama: string,
): Promise<DesaCentroid | null> {
  try {
    const collection = await loadGeoJson()
    const desaLower = desaNama.toLowerCase().trim()
    const kecLower = kecamatanNama.toLowerCase().trim()

    const feature = collection.features.find((f) => {
      const fDesa = (f.properties.kel_desa || '').toLowerCase().trim()
      const fKec = (f.properties.kecamatan || '').toLowerCase().trim()
      return fDesa === desaLower && fKec === kecLower
    })

    if (!feature) return null

    const coords = extractAllCoords(feature.geometry)
    if (coords.length === 0) return null

    const center = calculateBboxCenter(coords)

    return {
      latitude: Math.round(center.lat * 1000000) / 1000000,
      longitude: Math.round(center.lng * 1000000) / 1000000,
      desaNama: feature.properties.kel_desa,
      kecamatanNama: feature.properties.kecamatan,
      kodeDesa: feature.properties.kode_kd,
    }
  } catch (err) {
    console.error('[geojsonCentroid] Error:', err)
    return null
  }
}

/**
 * Mencari centroid desa berdasarkan kode desa (kode_kd).
 */
export async function findDesaCentroidByKode(kodeDesa: string): Promise<DesaCentroid | null> {
  try {
    const collection = await loadGeoJson()

    const feature = collection.features.find(
      (f) => f.properties.kode_kd === kodeDesa,
    )

    if (!feature) return null

    const coords = extractAllCoords(feature.geometry)
    if (coords.length === 0) return null

    const center = calculateBboxCenter(coords)

    return {
      latitude: Math.round(center.lat * 1000000) / 1000000,
      longitude: Math.round(center.lng * 1000000) / 1000000,
      desaNama: feature.properties.kel_desa,
      kecamatanNama: feature.properties.kecamatan,
      kodeDesa: feature.properties.kode_kd,
    }
  } catch (err) {
    console.error('[geojsonCentroid] Error:', err)
    return null
  }
}

/**
 * Memuat semua centroid desa sekaligus (untuk batch processing / dropdown).
 */
export async function getAllDesaCentroids(): Promise<DesaCentroid[]> {
  try {
    const collection = await loadGeoJson()
    const results: DesaCentroid[] = []

    for (const feature of collection.features) {
      const coords = extractAllCoords(feature.geometry)
      if (coords.length === 0) continue

      const center = calculateBboxCenter(coords)
      results.push({
        latitude: Math.round(center.lat * 1000000) / 1000000,
        longitude: Math.round(center.lng * 1000000) / 1000000,
        desaNama: feature.properties.kel_desa,
        kecamatanNama: feature.properties.kecamatan,
        kodeDesa: feature.properties.kode_kd,
      })
    }

    return results
  } catch (err) {
    console.error('[geojsonCentroid] Error:', err)
    return []
  }
}
