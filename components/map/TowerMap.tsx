'use client'

import React, { useState, useEffect, useCallback } from 'react'
import LeafletMapBase from './LeafletMapBase'
import TowerMarkers, { type TowerMapItem } from './TowerMarkers'
import MapLegend from './MapLegend'
import { Loader2 } from 'lucide-react'

type Props = {
  filterKecId?: string
  filterDesaId?: string
  onSelectDetail?: (id: string) => void
}

export default function TowerMap({ filterKecId = '', filterDesaId = '', onSelectDetail }: Props) {
  const [data, setData] = useState<TowerMapItem[]>([])
  const [loading, setLoading] = useState(true)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ for_map: 'true' })
    if (filterKecId) p.set('kecamatan_id', filterKecId)
    if (filterDesaId) p.set('desa_id', filterDesaId)
    return p
  }, [filterKecId, filterDesaId])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tower?${buildParams()}`).then((r) => r.json())
      if (res.success) {
        setData(res.data)
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs z-[500] flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-elevated border border-[var(--color-hairline)]">
            <Loader2 size={16} className="animate-spin text-[#2a9d99]" />
            <span className="text-xs font-medium text-foreground">Memuat lokasi tower...</span>
          </div>
        </div>
      )}

      <LeafletMapBase height="calc(100vh - 280px)">
        <TowerMarkers items={data} onSelectDetail={onSelectDetail} />
        <MapLegend showSinyal={false} showTower={true} />
      </LeafletMapBase>

      {/* Info bar bottom */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Menampilkan {data.length} tower (Disetujui)</span>
        <span>Hanya menampilkan infrastruktur terverifikasi</span>
      </div>
    </div>
  )
}
