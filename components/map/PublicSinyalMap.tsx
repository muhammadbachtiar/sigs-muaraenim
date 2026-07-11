'use client'

import React, { useState, useEffect, useCallback } from 'react'
import LeafletMapBase from './LeafletMapBase'
import SinyalMarkers, { type SinyalMapItem } from './SinyalMarkers'
import MapLegend from './MapLegend'
import MapBoundary from './MapBoundary'
import { Signal, Loader2, Info } from 'lucide-react'

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
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Find names for GeoJSON bounds matching
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
    if (!selectedDesaId) {
      setData([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/public/peta-sinyal?${buildParams()}`).then((r) => r.json())
      if (res.success) {
        setData(res.data)
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [selectedDesaId, buildParams])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!selectedDesaId) {
    return (
      <div className="relative w-full h-[calc(100vh-140px)] min-h-[450px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] flex flex-col items-center justify-center p-6 text-center shadow-soft">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] mb-4 animate-bounce">
          <Signal size={28} />
        </div>
        <h3 className="text-base font-bold text-foreground tracking-tight">Pilih Lokasi Terlebih Dahulu</h3>
        <p className="text-xs text-muted-foreground max-w-md mt-1.5 leading-relaxed">
          Silakan tentukan <span className="font-semibold text-foreground">Kecamatan</span> dan{' '}
          <span className="font-semibold text-foreground">Desa/Kelurahan</span> di panel atas untuk memuat data sebaran sinyal seluler publik.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] text-[11px] text-muted-foreground">
          <Info size={13} className="text-[var(--color-primary)] shrink-0" />
          Data bawaan dibatasi 6 bulan terakhir per wilayah desa
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs z-[500] flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-elevated border border-[var(--color-hairline)]">
            <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
            <span className="text-xs font-medium text-foreground">Memuat data sinyal wilayah...</span>
          </div>
        </div>
      )}

      <LeafletMapBase height="calc(100vh - 150px)">
        <MapBoundary
          selectedKecamatanNama={selectedKecamatanNama}
          selectedDesaNama={selectedDesaNama}
          kecamatanList={kecamatanList}
          desaList={desaList}
          onSelectKecamatan={onSelectKecamatan}
          onSelectDesa={onSelectDesa}
        />
        <SinyalMarkers items={data} />
        <MapLegend showSinyal={true} showTower={false} />
      </LeafletMapBase>

      {/* Info strip */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {searched && !loading ? `Ditemukan ${data.length} titik sinyal` : 'Memuat data...'}
        </span>
        <span className="text-[11px]">Kabupaten Muara Enim</span>
      </div>
    </div>
  )
}

