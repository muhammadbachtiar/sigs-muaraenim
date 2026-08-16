'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapLayers } from './LeafletMapBase'

type Props = {
  selectedKecamatanNama?: string
  selectedDesaNama?: string
  kecamatanList?: Array<{ id: string; nama: string }>
  desaList?: Array<{ id: string; nama: string }>
  onSelectKecamatan?: (id: string) => void
  onSelectDesa?: (id: string) => void
  showBoundaryProp?: boolean
  showMaskProp?: boolean
}

const cleanName = (name?: string) => {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/^(kecamatan|desa|kelurahan)\s+/i, '')
    .trim()
}

export default function MapBoundary({
  selectedKecamatanNama,
  selectedDesaNama,
  kecamatanList = [],
  desaList = [],
  onSelectKecamatan,
  onSelectDesa,
  showBoundaryProp,
  showMaskProp,
}: Props) {
  const map = useMap()
  const { showBoundary: ctxBoundary, showMask: ctxMask } = useMapLayers()
  const [kecamatanGeoJson, setKecamatanGeoJson] = useState<any>(null)
  const [desaGeoJson, setDesaGeoJson] = useState<any>(null)

  // Fetch GeoJSON files from /public/data
  useEffect(() => {
    fetch('/data/muara-enim-kecamatan.geojson')
      .then((r) => r.json())
      .then((data) => setKecamatanGeoJson(data))
      .catch((e) => console.error('Gagal memuat GeoJSON kecamatan:', e))

    fetch('/data/muara-enim-desa.geojson')
      .then((r) => r.json())
      .then((data) => setDesaGeoJson(data))
      .catch((e) => console.error('Gagal memuat GeoJSON desa/kelurahan:', e))
  }, [])

  const cleanKecFilter = useMemo(() => cleanName(selectedKecamatanNama), [selectedKecamatanNama])
  const cleanDesaFilter = useMemo(() => cleanName(selectedDesaNama), [selectedDesaNama])

  const hasFilterSelection = Boolean(cleanKecFilter || cleanDesaFilter)

  // Checklist state evaluation (respects prop override or context toggle)
  const isBoundaryActive = showBoundaryProp !== undefined ? showBoundaryProp : (ctxBoundary || hasFilterSelection)
  const isMaskActive = showMaskProp !== undefined ? showMaskProp : ctxMask

  // Inverted Donut Mask: Dims outer areas softly (not gloomy, very gentle contrast)
  const maskGeoJson = useMemo(() => {
    if (!isMaskActive || !kecamatanGeoJson?.features?.length) return null

    // Large bounding box covering the entire surrounding region
    const outerRing = [
      [70, -25],
      [140, -25],
      [140, 25],
      [70, 25],
      [70, -25],
    ]

    const holes: number[][][] = []

    kecamatanGeoJson.features.forEach((feature: any) => {
      if (!feature?.geometry) return
      const { type, coordinates } = feature.geometry
      if (type === 'Polygon') {
        if (coordinates[0]) holes.push(coordinates[0])
      } else if (type === 'MultiPolygon') {
        coordinates.forEach((poly: any) => {
          if (poly[0]) holes.push(poly[0])
        })
      }
    })

    return {
      type: 'Feature',
      properties: { isMask: true },
      geometry: {
        type: 'Polygon',
        coordinates: [outerRing, ...holes],
      },
    }
  }, [isMaskActive, kecamatanGeoJson])

  // Filtered GeoJSON data to render inside Muara Enim
  const renderedGeoJson = useMemo(() => {
    if (!isBoundaryActive) return null

    if (cleanDesaFilter && desaGeoJson) {
      // Find matching village/desa boundary
      const filteredFeatures = desaGeoJson.features.filter((f: any) => {
        const fDesa = cleanName(f.properties.kel_desa || f.properties.nama || '')
        const fKec = cleanName(f.properties.kecamatan || '')
        if (cleanKecFilter) {
          return fDesa === cleanDesaFilter && fKec === cleanKecFilter
        }
        return fDesa === cleanDesaFilter
      })
      if (filteredFeatures.length > 0) {
        return {
          type: 'FeatureCollection',
          features: filteredFeatures,
        }
      }
    }

    if (cleanKecFilter && desaGeoJson) {
      // Find ALL villages/desas that belong to the selected kecamatan
      const filteredFeatures = desaGeoJson.features.filter((f: any) => {
        const fKec = cleanName(f.properties.kecamatan || '')
        return fKec === cleanKecFilter
      })
      if (filteredFeatures.length > 0) {
        return {
          type: 'FeatureCollection',
          features: filteredFeatures,
        }
      }
    }

    // Default: return all kecamatan borders with red boundary lines
    return kecamatanGeoJson
  }, [isBoundaryActive, cleanKecFilter, cleanDesaFilter, kecamatanGeoJson, desaGeoJson])

  // Auto zoom map to fit boundary bounds when selection changes
  useEffect(() => {
    if (!renderedGeoJson || !map || !hasFilterSelection) return

    try {
      const leafletGeoJSON = L.geoJSON(renderedGeoJson)
      const bounds = leafletGeoJSON.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          animate: true,
          padding: [30, 30],
          maxZoom: cleanDesaFilter ? 14 : cleanKecFilter ? 12 : 10,
        })
      }
    } catch (e) {
      console.warn('Gagal menyesuaikan bounds peta:', e)
    }
  }, [renderedGeoJson, map, hasFilterSelection, cleanKecFilter, cleanDesaFilter])

  // Dynamic Styles: Always using red colors as requested
  const style = useMemo(() => {
    return (feature: any) => {
      const fDesa = cleanName(feature?.properties?.kel_desa || feature?.properties?.nama || '')
      const fKec = cleanName(feature?.properties?.kecamatan || feature?.properties?.nama || '')

      // Desa Filter Active
      if (cleanDesaFilter) {
        const isTarget = fDesa === cleanDesaFilter
        return {
          color: isTarget ? '#dc2626' : '#f87171',
          weight: isTarget ? 3.5 : 1,
          opacity: isTarget ? 0.95 : 0.4,
          fillColor: isTarget ? '#ef4444' : '#fca5a5',
          fillOpacity: isTarget ? 0.22 : 0.04,
        }
      }

      // Kecamatan Filter Active
      if (cleanKecFilter) {
        const isTarget = fKec === cleanKecFilter
        return {
          color: isTarget ? '#dc2626' : '#f87171',
          weight: isTarget ? 3 : 1,
          opacity: isTarget ? 0.9 : 0.35,
          fillColor: isTarget ? '#ef4444' : '#fca5a5',
          fillOpacity: isTarget ? 0.16 : 0.02,
        }
      }

      // Default Overview of Kabupaten Muara Enim: Crisp Red boundaries
      return {
        color: '#dc2626', // Merah tegas (Red-600)
        weight: 1.8,
        opacity: 0.85,
        fillColor: '#ef4444',
        fillOpacity: 0.04,
      }
    }
  }, [cleanKecFilter, cleanDesaFilter])

  // Bind tooltip and hover interaction on each feature
  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties.kel_desa || feature.properties.kecamatan || feature.properties.nama
    const type = feature.properties.jenis_kd || (feature.properties.kel_desa ? 'Desa/Kelurahan' : 'Kecamatan')

    if (name) {
      layer.bindTooltip(
        `<div style="font-family: inherit; padding: 2px 4px;">
          <div style="font-weight: 700; font-size: 12px; color: #0f172a;">${name}</div>
          <div style="font-size: 10px; color: #64748b;">${type} &bull; Kab. Muara Enim</div>
        </div>`,
        {
          sticky: true,
          direction: 'top',
          className: 'custom-map-tooltip',
        }
      )
    }

    layer.on({
      mouseover: (e: any) => {
        const l = e.target
        l.setStyle({
          color: '#b91c1c', // Merah pekat saat hover (Red-700)
          weight: 2.8,
          fillColor: '#ef4444',
          fillOpacity: 0.2,
        })
      },
      mouseout: (e: any) => {
        const l = e.target
        const defaultStyle = typeof style === 'function' ? style(feature) : style
        l.setStyle(defaultStyle)
      },
      click: () => {
        const isDesaFeature = !!feature.properties.kel_desa
        if (isDesaFeature) {
          const clickedDesaName = cleanName(feature.properties.kel_desa || feature.properties.nama)
          const match = desaList.find((d) => cleanName(d.nama) === clickedDesaName)
          if (match && onSelectDesa) {
            onSelectDesa(match.id)
          }
        } else {
          const clickedKecName = cleanName(feature.properties.kecamatan || feature.properties.nama)
          const match = kecamatanList.find((k) => cleanName(k.nama) === clickedKecName)
          if (match && onSelectKecamatan) {
            onSelectKecamatan(match.id)
          }
        }
      },
    })
  }

  // Force re-creating component when filters or toggle change
  const key = `${cleanKecFilter}-${cleanDesaFilter}-${isBoundaryActive}-${isMaskActive}-${!!kecamatanGeoJson}-${!!desaGeoJson}`

  return (
    <>
      {/* Soft Outer Dimming Mask Layer (Gentle slate, not gloomy) */}
      {maskGeoJson && (
        <GeoJSON
          key={`mask-${key}`}
          data={maskGeoJson as any}
          style={{
            fillColor: '#334155', // Soft slate
            fillOpacity: 0.14, // Sangat lembut & diredam, tidak suram
            stroke: false,
          }}
          interactive={false}
        />
      )}

      {/* High-Contrast Interactive Muara Enim Red Boundary Layer */}
      {renderedGeoJson && (
        <GeoJSON key={key} data={renderedGeoJson} style={style as any} onEachFeature={onEachFeature} />
      )}
    </>
  )
}
