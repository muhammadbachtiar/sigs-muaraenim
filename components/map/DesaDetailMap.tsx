'use client'

import React, { useState, useEffect } from 'react'
import LeafletMapBase from './LeafletMapBase'
import SinyalMarkers, { type SinyalMapItem } from './SinyalMarkers'
import TowerMarkers, { type TowerMapItem } from './TowerMarkers'
import MapLegend from './MapLegend'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Loader2, MapPin } from 'lucide-react'

type Props = {
  desaId: string
  desaNama: string
  latitude: number | null
  longitude: number | null
}

const desaPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export default function DesaDetailMap({ desaId, desaNama, latitude, longitude }: Props) {
  const [sinyalData, setSinyalData] = useState<SinyalMapItem[]>([])
  const [towerData, setTowerData] = useState<TowerMapItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [sinyalRes, towerRes] = await Promise.all([
          fetch(`/api/sinyal?for_map=true&desa_id=${desaId}&all_time=true`).then(r => r.json()),
          fetch(`/api/tower?for_map=true`).then(r => r.json()),
        ])

        if (sinyalRes.success) setSinyalData(sinyalRes.data)
        if (towerRes.success) setTowerData(towerRes.data)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [desaId])

  const hasCenter = latitude != null && longitude != null
  const center: [number, number] = hasCenter
    ? [latitude, longitude]
    : [-3.75, 103.75]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">Peta Sebaran Data Desa</h3>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs z-[500] flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-elevated border border-[var(--color-hairline)]">
              <Loader2 size={16} className="animate-spin text-primary" />
              <span className="text-xs font-medium">Memuat peta desa...</span>
            </div>
          </div>
        )}

        <LeafletMapBase center={center} zoom={hasCenter ? 13 : 10} height="320px">
          {hasCenter && (
            <Marker position={[latitude, longitude]} icon={desaPinIcon}>
              <Popup>
                <div className="text-xs font-medium">
                  <p className="font-bold">{desaNama}</p>
                  <p className="text-gray-500">Pusat Koordinat Desa</p>
                </div>
              </Popup>
            </Marker>
          )}
          <SinyalMarkers items={sinyalData} />
          <TowerMarkers items={towerData} />
          <MapLegend showSinyal={true} showTower={true} />
        </LeafletMapBase>
      </div>

      {!hasCenter && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <MapPin size={12} />
          Koordinat pusat desa belum diisi. Peta menampilkan tampilan default kabupaten.
        </p>
      )}
    </div>
  )
}
