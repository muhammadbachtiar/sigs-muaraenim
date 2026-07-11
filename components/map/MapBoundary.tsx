'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'

type Props = {
  selectedKecamatanNama?: string
  selectedDesaNama?: string
  kecamatanList?: Array<{ id: string; nama: string }>
  desaList?: Array<{ id: string; nama: string }>
  onSelectKecamatan?: (id: string) => void
  onSelectDesa?: (id: string) => void
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
}: Props) {
  const map = useMap()
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

  // Filtered GeoJSON data to render on the map
  const renderedGeoJson = useMemo(() => {
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

    // Default: return all kecamatan borders for background context
    return kecamatanGeoJson
  }, [cleanKecFilter, cleanDesaFilter, kecamatanGeoJson, desaGeoJson])

  // Auto zoom map to fit boundary bounds when selection changes
  useEffect(() => {
    if (!renderedGeoJson || !map) return

    try {
      const leafletGeoJSON = L.geoJSON(renderedGeoJson)
      const bounds = leafletGeoJSON.getBounds()
      if (bounds.isValid()) {
        // Zoom to boundary with standard padding
        map.fitBounds(bounds, {
          animate: true,
          padding: [35, 35],
          maxZoom: 14, // Limit zoom on small desa boundaries
        })
      }
    } catch (e) {
      console.warn('Gagal menyesuaikan bounds peta:', e)
    }
  }, [renderedGeoJson, map])

  // Styles for the boundary polygon
  const style = useMemo(() => {
    if (cleanDesaFilter) {
      return {
        color: '#dc2626', // Merah tegas (Red-600) untuk desa terpilih
        weight: 3.5,
        opacity: 0.9,
        fillColor: '#dc2626',
        fillOpacity: 0.15,
      }
    }
    if (cleanKecFilter) {
      return {
        color: '#ef4444', // Merah (Red-500) untuk desa-desa di dalam kecamatan terpilih
        weight: 2.5,
        opacity: 0.8,
        fillColor: '#ef4444',
        fillOpacity: 0.08,
      }
    }
    return {
      color: '#fca5a5', // Merah muda lembut (Red-300) untuk outline latar belakang
      weight: 1.5,
      opacity: 0.4,
      fillColor: '#fca5a5',
      fillOpacity: 0.01,
    }
  }, [cleanKecFilter, cleanDesaFilter])

  // Bind tooltip and hover interaction on each feature
  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties.kel_desa || feature.properties.kecamatan || feature.properties.nama
    const type = feature.properties.jenis_kd || (feature.properties.kel_desa ? 'Desa/Kelurahan' : 'Kecamatan')

    if (name) {
      layer.bindTooltip(`<strong>${name}</strong><br/><span style="font-size: 10px; opacity: 0.8;">${type}</span>`, {
        sticky: true,
        direction: 'top',
      })
    }

    layer.on({
      mouseover: (e: any) => {
        const l = e.target
        l.setStyle({
          color: '#b91c1c', // Merah gelap (Red-700) saat hover
          weight: 4,
          fillOpacity: 0.25,
        })
      },
      mouseout: (e: any) => {
        const l = e.target
        l.setStyle(style) // Kembalikan ke style asli
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

  if (!renderedGeoJson) return null

  // Force re-creating component when filters load or change to refresh layer in Leaflet
  const key = `${cleanKecFilter}-${cleanDesaFilter}-${!!kecamatanGeoJson}-${!!desaGeoJson}`

  return <GeoJSON key={key} data={renderedGeoJson} style={style} onEachFeature={onEachFeature} />
}
