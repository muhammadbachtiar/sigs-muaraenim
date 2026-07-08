'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { getSignalColor } from '@/lib/constants'
import type { IdwGridCell } from '@/lib/idw'

type Props = {
  cells: IdwGridCell[]
  resolutionM?: number
  opacity?: number
}

export default function IdwGridLayer({ cells, resolutionM = 200, opacity = 0.55 }: Props) {
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!map || cells.length === 0) return

    // Bersihkan layer sebelumnya
    if (layerGroupRef.current) {
      layerGroupRef.current.clearLayers()
      map.removeLayer(layerGroupRef.current)
    }

    const group = L.layerGroup()

    // Hitung ukuran setengah sel dalam derajat
    const degPerKm = 1 / 111.32
    const halfLat = (resolutionM / 1000) * degPerKm / 2
    const halfLng =
      (resolutionM / 1000) *
      degPerKm /
      (2 * Math.cos((cells[0]?.latitude * Math.PI) / 180 || 0))

    for (const cell of cells) {
      if (cell.rsrp === null) continue

      const { color } = getSignalColor(cell.rsrp)

      const bounds: L.LatLngBoundsExpression = [
        [cell.latitude - halfLat, cell.longitude - halfLng],
        [cell.latitude + halfLat, cell.longitude + halfLng],
      ]

      const rect = L.rectangle(bounds, {
        color: 'transparent',
        weight: 0,
        fillColor: color,
        fillOpacity: opacity,
      })

      // Tooltip ringkas di tiap sel
      rect.bindTooltip(
        `<div class="text-xs font-mono">
          <span class="font-bold">RSRP: ${cell.rsrp} dBm</span><br/>
          <span class="text-gray-500">${getSignalColor(cell.rsrp).label}</span>
        </div>`,
        { sticky: true, className: 'idw-cell-tooltip' },
      )

      group.addLayer(rect)
    }

    group.addTo(map)
    layerGroupRef.current = group

    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers()
        map.removeLayer(layerGroupRef.current)
        layerGroupRef.current = null
      }
    }
  }, [map, cells, resolutionM, opacity])

  return null
}
