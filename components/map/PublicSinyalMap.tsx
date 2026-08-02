'use client'

import React, { useState, useEffect, useCallback } from 'react'
import LeafletMapBase from './LeafletMapBase'
import SinyalMarkers, { type SinyalMapItem } from './SinyalMarkers'
import MapLegend from './MapLegend'
import MapBoundary from './MapBoundary'
import { Loader2, Info, TriangleAlert } from 'lucide-react'

type Props = {
  selectedKecamatanId: string
  selectedDesaId: string
  selectedOperators?: string[]
  tanggalDari?: string
  tanggalSampai?: string
  kecamatanList?: Array<{ id: string; nama: string }>
  desaList?: Array<{ id: string; nama: string }>
  onSelectKecamatan?: (id: string) => void
  onSelectDesa?: (id: string) => void
}

export default function PublicSinyalMap({
  selectedKecamatanId,
  selectedDesaId,
  selectedOperators = [],
  tanggalDari = '',
  tanggalSampai = '',
  kecamatanList = [],
  desaList = [],
  onSelectKecamatan,
  onSelectDesa,
}: Props) {
  const [data, setData] = useState<SinyalMapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<{ total: number; limit: number; level: string } | null>(null)

  // Nama wilayah terpilih (untuk MapBoundary + zoom)
  const selectedKecamatanNama = kecamatanList.find((k) => k.id === selectedKecamatanId)?.nama
  const selectedDesaNama = desaList.find((d) => d.id === selectedDesaId)?.nama

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (selectedKecamatanId) p.set('kecamatan_id', selectedKecamatanId)
    if (selectedDesaId) p.set('desa_id', selectedDesaId)
    if (selectedOperators.length) p.set('operator_id', selectedOperators.join(','))
    if (tanggalDari) p.set('tanggal_dari', tanggalDari)
    if (tanggalSampai) p.set('tanggal_sampai', tanggalSampai)
    return p
  }, [selectedKecamatanId, selectedDesaId, selectedOperators, tanggalDari, tanggalSampai])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/public/peta-sinyal?${buildParams()}`).then((r) => r.json())
      if (res.success) {
        setData(res.data)
        setMeta(res.meta ?? null)
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // Fetch data otomatis saat komponen mount DAN setiap kali filter berubah
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Level filter aktif (untuk pesan info bar)
  const filterLevel = selectedDesaId
    ? 'desa'
    : selectedKecamatanId
      ? 'kecamatan'
      : 'kabupaten'

  const levelLabel = {
    desa: selectedDesaNama ?? 'Desa',
    kecamatan: selectedKecamatanNama ?? 'Kecamatan',
    kabupaten: 'Seluruh Kabupaten Muara Enim',
  }[filterLevel]

  // Apakah data mendekati limit (informasi untuk user)
  const isNearLimit = meta && meta.total >= meta.limit * 0.95

  return (
    <div className="relative w-full">
      {/* Floating loading badge (tidak menutupi peta sehingga tidak ada glitch/flicker) */}
      {loading && (
        <div className="absolute top-3 right-3 z-[400] flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-full shadow-md border border-[var(--color-hairline)] text-xs font-medium animate-in fade-in duration-200">
          <Loader2 size={14} className="animate-spin text-[var(--color-primary)]" />
          <span className="text-[11px] text-foreground font-medium">
            {filterLevel === 'kabupaten'
              ? 'Memuat data kabupaten...'
              : filterLevel === 'kecamatan'
                ? `Memuat Kec. ${selectedKecamatanNama ?? ''}...`
                : `Memuat Desa ${selectedDesaNama ?? ''}...`}
          </span>
        </div>
      )}

      <LeafletMapBase height="calc(100vh - 150px)">
        {/* Batas wilayah & layer GeoJSON — zoom adaptive */}
        <MapBoundary
          selectedKecamatanNama={selectedKecamatanNama}
          selectedDesaNama={selectedDesaNama}
          kecamatanList={kecamatanList}
          desaList={desaList}
          onSelectKecamatan={onSelectKecamatan}
          onSelectDesa={onSelectDesa}
        />

        {/* Marker Cluster — rendering ribuan titik secara efisien */}
        <SinyalMarkers items={data} />

        <MapLegend showSinyal={true} showTower={false} />
      </LeafletMapBase>

      {/* Info bar bawah peta */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {/* Kiri: jumlah titik & level */}
        <div className="flex items-center gap-2">
          {!loading && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] inline-block" />
                {data.length.toLocaleString('id-ID')} titik sinyal
              </span>
              <span className="text-[var(--color-hairline)]">·</span>
              <span className="font-medium text-foreground">{levelLabel}</span>
            </>
          )}
          {loading && <span className="text-muted-foreground">Memuat data...</span>}
        </div>

        {/* Kanan: info tip / peringatan limit */}
        <div className="flex items-center gap-1.5">
          {isNearLimit && !loading && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium">
              <TriangleAlert size={10} />
              Data dibatasi {meta?.limit?.toLocaleString('id-ID')} titik. Filter wilayah untuk detail lebih lengkap.
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px]">
            <Info size={10} className="text-[var(--color-primary)]" />
            Zoom in untuk melihat titik sinyal individual
          </span>
        </div>
      </div>
    </div>
  )
}
