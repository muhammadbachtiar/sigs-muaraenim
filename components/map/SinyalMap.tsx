'use client'

import React, { useState, useEffect, useCallback } from 'react'
import LeafletMapBase from './LeafletMapBase'
import SinyalMarkers, { type SinyalMapItem } from './SinyalMarkers'
import MapLegend from './MapLegend'
import { Loader2 } from 'lucide-react'

type Props = {
  selectedOperators?: string[]
  selectedTeknologi?: string[]
  selectedKecamatan?: string
  selectedDesa?: string
  tanggalDari?: string
  tanggalSampai?: string
  onSelectDetail?: (id: string) => void
}

export default function SinyalMap({
  selectedOperators = [],
  selectedTeknologi = [],
  selectedKecamatan = '',
  selectedDesa = '',
  tanggalDari = '',
  tanggalSampai = '',
  onSelectDetail,
}: Props) {
  const [data, setData] = useState<SinyalMapItem[]>([])
  const [loading, setLoading] = useState(true)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ for_map: 'true' })
    if (selectedOperators.length) p.set('operator_id', selectedOperators.join(','))
    if (selectedTeknologi.length) p.set('teknologi_id', selectedTeknologi.join(','))
    if (selectedKecamatan) p.set('kecamatan_id', selectedKecamatan)
    if (selectedDesa) p.set('desa_id', selectedDesa)
    if (tanggalDari) p.set('tanggal_dari', tanggalDari)
    if (tanggalSampai) p.set('tanggal_sampai', tanggalSampai)
    return p
  }, [selectedOperators, selectedTeknologi, selectedKecamatan, selectedDesa, tanggalDari, tanggalSampai])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sinyal?${buildParams()}`).then((r) => r.json())
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
            <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
            <span className="text-xs font-medium text-foreground">Memuat titik sinyal...</span>
          </div>
        </div>
      )}

      <LeafletMapBase height="calc(100vh - 280px)">
        <SinyalMarkers items={data} onSelectDetail={onSelectDetail} />
        <MapLegend showSinyal={true} showTower={false} />
      </LeafletMapBase>

      {/* Info bar bottom */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Menampilkan {data.length} titik sinyal</span>
        <span>Filter waktu & operator aktif</span>
      </div>
    </div>
  )
}
