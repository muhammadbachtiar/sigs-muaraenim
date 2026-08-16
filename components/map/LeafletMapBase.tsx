'use client'

import React, { useEffect, useState, createContext, useContext } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_CENTER } from '@/lib/constants'
import { Layers, Map as MapIcon, Globe, CheckSquare, Square } from 'lucide-react'

export type BasemapType = 'clean' | 'osm' | 'satellite'

export interface MapLayerContextValue {
  basemap: BasemapType
  setBasemap: (t: BasemapType) => void
  showBoundary: boolean
  setShowBoundary: (v: boolean | ((p: boolean) => boolean)) => void
  showMask: boolean
  setShowMask: (v: boolean | ((p: boolean) => boolean)) => void
}

export const MapLayerContext = createContext<MapLayerContextValue>({
  basemap: 'osm',
  setBasemap: () => { },
  showBoundary: false,
  setShowBoundary: () => { },
  showMask: false,
  setShowMask: () => { },
})

export const useMapLayers = () => useContext(MapLayerContext)

type Props = {
  center?: [number, number]
  zoom?: number
  height?: string
  className?: string
  enableBasemapSwitcher?: boolean
  enableLayerControls?: boolean
  defaultBasemap?: BasemapType
  defaultShowBoundary?: boolean
  defaultShowMask?: boolean
  children?: React.ReactNode
}

const BASEMAP_CONFIGS: Record<BasemapType, { name: string; url: string; attribution: string; maxZoom?: number; subdomains?: string }> = {
  osm: {
    name: 'Jalan',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  clean: {
    name: 'Terang',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  satellite: {
    name: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, and GIS User Community',
    maxZoom: 18,
  },
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    // Multi-pass invalidateSize to handle hydration, dynamic import, & tab-switch glitches
    const t1 = setTimeout(() => map.invalidateSize(), 100)
    const t2 = setTimeout(() => map.invalidateSize(), 350)
    const t3 = setTimeout(() => map.invalidateSize(), 700)

    // ResizeObserver: auto-invalidate whenever the container changes size
    let observer: ResizeObserver | null = null
    const container = map.getContainer()
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize()
      })
      observer.observe(container)
    }

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      observer?.disconnect()
    }
  }, [map])
  return null
}

function MapViewController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), { animate: true })
    }
  }, [center, zoom, map])
  return null
}

export default function LeafletMapBase({
  center = [MAP_CENTER.lat, MAP_CENTER.lng],
  zoom = MAP_CENTER.zoom,
  height = '400px',
  className = '',
  enableBasemapSwitcher = true,
  enableLayerControls = true,
  defaultBasemap = 'osm', // Default adalah opsi jalan sesuai permintaan
  defaultShowBoundary = true, // Default tidak check garis batas
  defaultShowMask = false, // Default tidak check fokus wilayah
  children,
}: Props) {
  const [basemap, setBasemap] = useState<BasemapType>(defaultBasemap)
  const [showBoundary, setShowBoundary] = useState<boolean>(defaultShowBoundary)
  const [showMask, setShowMask] = useState<boolean>(defaultShowMask)

  const currentTile = BASEMAP_CONFIGS[basemap]

  return (
    <MapLayerContext.Provider
      value={{
        basemap,
        setBasemap,
        showBoundary,
        setShowBoundary,
        showMask,
        setShowMask,
      }}
    >
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-[var(--color-hairline)] shadow-soft z-0 ${className}`}
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', zIndex: 0 }}
        >
          <TileLayer
            key={basemap}
            url={currentTile.url}
            attribution={currentTile.attribution}
            maxZoom={currentTile.maxZoom}
            subdomains={currentTile.subdomains || 'abc'}
          />
          <MapResizer />
          <MapViewController center={center} zoom={zoom} />
          {children}
        </MapContainer>

        {/* Floating Basemap & Layer Checklist Controls */}
        {enableLayerControls && (
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-[var(--color-hairline)] shadow-md rounded-lg p-1.5 flex flex-wrap items-center gap-2 text-xs select-none">
            {/* Basemap Switcher */}
            {enableBasemapSwitcher && (
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: 'osm', label: 'Jalan', icon: Layers },
                    { key: 'clean', label: 'Terang', icon: MapIcon },
                    { key: 'satellite', label: 'Satelit', icon: Globe },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon
                  const isActive = basemap === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setBasemap(item.key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                    >
                      <Icon size={12} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Separator Divider */}
            <div className="h-4 w-px bg-[var(--color-hairline)] mx-0.5 hidden sm:block" />

            {/* Checklists: 1. Garis Batas  2. Fokus Wilayah */}
            <div className="flex items-center gap-2.5 pl-0.5">
              {/* Check 1: Garis Batas */}
              <label
                className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium"
                title="Tampilkan garis batas wilayah Kabupaten & Kecamatan"
              >
                <input
                  type="checkbox"
                  checked={showBoundary}
                  onChange={(e) => setShowBoundary(e.target.checked)}
                  className="sr-only"
                />
                {showBoundary ? (
                  <CheckSquare size={14} className="text-primary shrink-0" />
                ) : (
                  <Square size={14} className="text-muted-foreground shrink-0" />
                )}
                <span>Garis Batas</span>
              </label>

              {/* Check 2: Fokus Wilayah */}
              <label
                className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium"
                title="Redupkan wilayah luar agar Kabupaten Muara Enim lebih fokus"
              >
                <input
                  type="checkbox"
                  checked={showMask}
                  onChange={(e) => setShowMask(e.target.checked)}
                  className="sr-only"
                />
                {showMask ? (
                  <CheckSquare size={14} className="text-primary shrink-0" />
                ) : (
                  <Square size={14} className="text-muted-foreground shrink-0" />
                )}
                <span>Fokus Wilayah</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </MapLayerContext.Provider>
  )
}
