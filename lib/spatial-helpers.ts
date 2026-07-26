/**
 * Spatial helper functions for SIGS Muara Enim
 * - Point-in-polygon detection
 * - Auto-detect desa/kecamatan from coordinates
 * - Haversine distance calculation
 */

export type GeoJsonFeature = {
  type: 'Feature'
  properties: Record<string, any>
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export type DetectedArea = {
  desaNama: string
  kecamatanNama: string
  feature: GeoJsonFeature
} | null

/**
 * Ray-casting point-in-polygon test.
 * GeoJSON coordinates are stored as [lng, lat].
 * This function takes lat, lng separately.
 */
export function isPointInPolygon(lat: number, lng: number, feature: GeoJsonFeature): boolean {
  try {
    const geom = feature.geometry
    if (!geom) return false

    const checkRing = (ring: number[][]): boolean => {
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        // GeoJSON: ring[i] = [lng, lat]
        const ringLng_i = ring[i][0], ringLat_i = ring[i][1]
        const ringLng_j = ring[j][0], ringLat_j = ring[j][1]
        const intersect =
          ((ringLat_i > lat) !== (ringLat_j > lat)) &&
          (lng < (ringLng_j - ringLng_i) * (lat - ringLat_i) / (ringLat_j - ringLat_i) + ringLng_i)
        if (intersect) inside = !inside
      }
      return inside
    }

    if (geom.type === 'Polygon') {
      return checkRing(geom.coordinates[0] as number[][])
    }
    if (geom.type === 'MultiPolygon') {
      return (geom.coordinates as number[][][][]).some((poly) => checkRing(poly[0]))
    }
  } catch {
    // ignore malformed geometry
  }
  return false
}

/**
 * Haversine formula to compute great-circle distance between two points (in km).
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Clean a village/kecamatan name for comparison.
 * Strips prefixes like "Kecamatan", "Desa", "Kelurahan".
 */
export function cleanName(name?: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/^(kecamatan|desa|kelurahan)\s+/i, '')
    .trim()
}

// Cache for GeoJSON data
let _desaGeoJsonCache: { features: GeoJsonFeature[] } | null = null
let _desaGeoJsonPromise: Promise<{ features: GeoJsonFeature[] }> | null = null

/**
 * Load and cache desa GeoJSON data from /public/data/muara-enim-desa.geojson.
 */
export async function loadDesaGeoJson(): Promise<{ features: GeoJsonFeature[] }> {
  if (_desaGeoJsonCache) return _desaGeoJsonCache
  if (_desaGeoJsonPromise) return _desaGeoJsonPromise

  _desaGeoJsonPromise = fetch('/data/muara-enim-desa.geojson')
    .then(r => r.json())
    .then(data => {
      _desaGeoJsonCache = data
      return data
    })
    .catch(() => {
      _desaGeoJsonPromise = null
      return { features: [] }
    })

  return _desaGeoJsonPromise
}

/**
 * Auto-detect which desa/kecamatan a coordinate falls within,
 * using the GeoJSON boundary data.
 * Returns the detected desa name, kecamatan name, and GeoJSON feature.
 */
export async function detectDesaFromCoords(
  lat: number,
  lng: number
): Promise<DetectedArea> {
  try {
    const geoData = await loadDesaGeoJson()
    if (!geoData.features || geoData.features.length === 0) return null

    for (const feature of geoData.features) {
      if (isPointInPolygon(lat, lng, feature)) {
        const desaNama = feature.properties.kel_desa || feature.properties.nama || ''
        const kecamatanNama = feature.properties.kecamatan || ''
        return { desaNama, kecamatanNama, feature }
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Find the GeoJSON feature for a specific desa by name (and optionally kecamatan).
 */
export async function findDesaFeature(
  desaNama: string,
  kecamatanNama?: string
): Promise<GeoJsonFeature | null> {
  try {
    const geoData = await loadDesaGeoJson()
    if (!geoData.features) return null

    const search = desaNama.toLowerCase().trim()
    const kecSearch = kecamatanNama?.toLowerCase().trim()

    return geoData.features.find(f => {
      const fDesa = (f.properties.kel_desa || f.properties.nama || '').toLowerCase().trim()
      const fKec = (f.properties.kecamatan || '').toLowerCase().trim()

      if (kecSearch) {
        return (fDesa === search || f.properties.ori_name?.toLowerCase().trim() === search) && fKec === kecSearch
      }
      return fDesa === search || f.properties.ori_name?.toLowerCase().trim() === search
    }) ?? null
  } catch {
    return null
  }
}

/**
 * Check if a point is inside the Kabupaten Muara Enim bounding region (rough bbox).
 */
export function isInsideMuaraEnim(lat: number, lng: number): boolean {
  // Approximate bounding box for Kabupaten Muara Enim
  return lat >= -4.5 && lat <= -3.0 && lng >= 103.0 && lng <= 104.5
}
