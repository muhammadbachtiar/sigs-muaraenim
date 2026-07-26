'use client'

import React, { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_CENTER } from '@/lib/constants'

type Props = {
  center?: [number, number]
  zoom?: number
  height?: string
  className?: string
  children?: React.ReactNode
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
  children,
}: Props) {
  return (
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />
        <MapViewController center={center} zoom={zoom} />
        {children}
      </MapContainer>
    </div>
  )
}
