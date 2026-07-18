'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, TriangleAlert, Lightbulb, Check } from 'lucide-react'
import { MapContainer, TileLayer, GeoJSON, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const pickerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type GeoJsonFeature = {
  type: 'Feature'
  properties: Record<string, any>
  geometry: any
}

type IdwPrediction = {
  predictedRsrp: number | null
  predictedRssi: number | null
  predictedRsrq: number | null
  predictedSnr: number | null
  totalDataInBbox: number
}

type Props = {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
  selectedDesaNama?: string
  selectedKecamatanNama?: string
  userRole?: 'SUPER_ADMIN' | 'PEMDES'
  showIdwRecommendation?: boolean
  onIdwRecommendation?: (prediction: IdwPrediction) => void
}

function isPointInPolygon(lat: number, lng: number, geoJsonFeature: GeoJsonFeature): boolean {
  try {
    const geom = geoJsonFeature.geometry
    if (!geom) return false

    const checkRing = (ring: number[][]): boolean => {
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1]
        const xj = ring[j][0], yj = ring[j][1]
        const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
        if (intersect) inside = !inside
      }
      return inside
    }

    if (geom.type === 'Polygon') {
      return checkRing(geom.coordinates[0])
    }
    if (geom.type === 'MultiPolygon') {
      return geom.coordinates.some((poly: number[][][]) => checkRing(poly[0]))
    }
  } catch {
    // ignore
  }
  return false
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function AutoFitBounds({ feature }: { feature: GeoJsonFeature | null }) {
  const map = useMap()
  useEffect(() => {
    if (!feature) return
    try {
      const layer = L.geoJSON(feature as any)
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] })
      }
    } catch {
      // ignore invalid geometry
    }
  }, [feature, map])
  return null
}

export default function MapCoordinatePicker({
  latitude,
  longitude,
  onChange,
  selectedDesaNama,
  selectedKecamatanNama,
  userRole,
  showIdwRecommendation = false,
  onIdwRecommendation,
}: Props) {
  const [geoData, setGeoData] = useState<GeoJsonFeature | null>(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [isOutside, setIsOutside] = useState(false)
  const [idwPrediction, setIdwPrediction] = useState<IdwPrediction | null>(null)
  const [fetchingIdw, setFetchingIdw] = useState(false)
  const [idwApplied, setIdwApplied] = useState(false)
  const geoJsonKey = useRef(0)

  const center: [number, number] = latitude != null && longitude != null
    ? [latitude, longitude]
    : [-3.75, 103.85]

  // Load GeoJSON boundary
  useEffect(() => {
    if (!selectedDesaNama && !selectedKecamatanNama) {
      setGeoData(null)
      return
    }
    setLoadingGeo(true)
    fetch('/data/muara-enim-desa.geojson')
      .then(r => r.json())
      .then(json => {
        const features: GeoJsonFeature[] = json.features
        let found: GeoJsonFeature | null = null

        if (selectedDesaNama) {
          const search = selectedDesaNama.toLowerCase().trim()
          found = features.find(f =>
            f.properties.kel_desa?.toLowerCase().trim() === search ||
            f.properties.nama?.toLowerCase().includes(search) ||
            f.properties.ori_name?.toLowerCase().trim() === search
          ) ?? null
        }

        if (!found && selectedKecamatanNama) {
          // Group all features for the kecamatan and merge them
          const kecSearch = selectedKecamatanNama.toLowerCase().trim()
          const kecFeatures = features.filter(f =>
            f.properties.kecamatan?.toLowerCase().trim() === kecSearch
          )
          if (kecFeatures.length > 0) {
            found = kecFeatures[0]
          }
        }

        geoJsonKey.current += 1
        setGeoData(found)
      })
      .catch(() => setGeoData(null))
      .finally(() => setLoadingGeo(false))
  }, [selectedDesaNama, selectedKecamatanNama])

  // Check if current coordinate is inside the boundary
  useEffect(() => {
    if (!geoData || latitude == null || longitude == null || userRole !== 'PEMDES') {
      setIsOutside(false)
      return
    }
    setIsOutside(!isPointInPolygon(longitude, latitude, geoData))
  }, [geoData, latitude, longitude, userRole])

  // Fetch IDW prediction when coordinate changes
  useEffect(() => {
    if (!showIdwRecommendation || latitude == null || longitude == null) {
      setIdwPrediction(null)
      return
    }
    setFetchingIdw(true)
    setIdwApplied(false)
    const controller = new AbortController()
    fetch('/api/sinyal/predict-idw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.predictedRsrp !== undefined) {
          setIdwPrediction({
            predictedRsrp: res.predictedRsrp,
            predictedRssi: res.predictedRssi,
            predictedRsrq: res.predictedRsrq,
            predictedSnr: res.predictedSnr,
            totalDataInBbox: res.totalDataInBbox ?? 0,
          })
        } else {
          setIdwPrediction(null)
        }
      })
      .catch(() => setIdwPrediction(null))
      .finally(() => setFetchingIdw(false))
    return () => controller.abort()
  }, [latitude, longitude, showIdwRecommendation])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    onChange(lat, lng)
  }, [onChange])

  const handleApplyIdw = () => {
    if (!idwPrediction || !onIdwRecommendation) return
    onIdwRecommendation(idwPrediction)
    setIdwApplied(true)
  }

  const getSignalBadge = (rsrp: number | null) => {
    if (rsrp == null) return null
    if (rsrp >= -80) return { label: 'Sangat Baik', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    if (rsrp >= -95) return { label: 'Baik', color: 'text-green-700 bg-green-50 border-green-200' }
    if (rsrp >= -110) return { label: 'Lemah', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    return { label: 'Sangat Lemah / Blankspot', color: 'text-red-700 bg-red-50 border-red-200' }
  }

  const signalBadge = showIdwRecommendation ? getSignalBadge(idwPrediction?.predictedRsrp ?? null) : null

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-hairline shadow-soft" style={{ height: 340 }}>
        {loadingGeo && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 size={20} className="animate-spin text-primary mr-2" />
            <span className="text-xs text-muted-foreground">Memuat batas wilayah...</span>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={latitude != null ? 13 : 10}
          style={{ height: '100%', width: '100%', cursor: 'crosshair' }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {geoData && (
            <GeoJSON
              key={geoJsonKey.current}
              data={geoData as any}
              style={{
                color: '#ef4444',
                weight: 2.5,
                fillColor: '#ef4444',
                fillOpacity: 0.08,
                dashArray: '5, 4',
              }}
            />
          )}

          {latitude != null && longitude != null && (
            <Marker position={[latitude, longitude]} icon={pickerIcon} />
          )}

          <MapClickHandler onClick={handleMapClick} />
          <AutoFitBounds feature={geoData} />
        </MapContainer>

        {/* Hint overlay */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium shadow-lg">
            <MapPin size={11} />
            Klik pada peta untuk menentukan titik koordinat
          </div>
        </div>
      </div>

      {/* Out of boundary warning for PEMDES */}
      {isOutside && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
          <TriangleAlert size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <p>
            Titik yang dipilih berada di luar batas wilayah administrasi desa Anda.
            Data tetap dapat disimpan untuk ditinjau oleh administrator.
          </p>
        </div>
      )}

      {/* Coordinate display */}
      {latitude != null && longitude != null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-canvas-soft)] border border-hairline text-xs font-mono text-muted-foreground">
          <MapPin size={12} className="text-primary shrink-0" />
          <span>
            Lat: <strong className="text-foreground">{latitude.toFixed(6)}</strong>
            {' '}&nbsp;{' '}
            Lng: <strong className="text-foreground">{longitude.toFixed(6)}</strong>
          </span>
        </div>
      )}

      {/* IDW signal recommendation panel */}
      {showIdwRecommendation && latitude != null && longitude != null && (
        <div className="rounded-lg border border-hairline bg-[var(--color-canvas-soft)] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Lightbulb size={13} className="text-primary" />
              Prediksi Kekuatan Sinyal (IDW)
            </div>
            {fetchingIdw && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
          </div>

          {!fetchingIdw && idwPrediction && idwPrediction.totalDataInBbox > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'RSRP', value: idwPrediction.predictedRsrp, unit: 'dBm' },
                  { label: 'RSSI', value: idwPrediction.predictedRssi, unit: 'dBm' },
                  { label: 'RSRQ', value: idwPrediction.predictedRsrq, unit: 'dB' },
                  { label: 'SNR', value: idwPrediction.predictedSnr, unit: 'dB' },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="flex items-center justify-between px-2 py-1 rounded bg-background border border-hairline">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium text-foreground">
                      {value != null ? `${Math.round(value)} ${unit}` : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {signalBadge && (
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${signalBadge.color}`}>
                  {signalBadge.label}
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyIdw}
                disabled={idwApplied}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg border border-primary text-primary hover:bg-primary/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {idwApplied ? <Check size={13} /> : <Lightbulb size={13} />}
                {idwApplied ? 'Rekomendasi Diterapkan' : 'Gunakan Rekomendasi Nilai Sinyal'}
              </button>
              <p className="text-[10px] text-muted-foreground">
                *Berdasarkan {idwPrediction.totalDataInBbox} data pengukuran terdekat. Anda tetap dapat mengedit nilai secara manual.
              </p>
            </>
          )}

          {!fetchingIdw && (!idwPrediction || idwPrediction.totalDataInBbox === 0) && (
            <p className="text-xs text-muted-foreground">
              Belum cukup data pengukuran sinyal di sekitar lokasi ini untuk menghasilkan rekomendasi.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
