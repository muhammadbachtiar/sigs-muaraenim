'use client'

import React, { useState, useEffect, useCallback } from 'react'
import LeafletMapBase from './LeafletMapBase'
import SinyalMarkers, { type SinyalMapItem } from './SinyalMarkers'
import MapLegend from './MapLegend'
import IdwMarker, { type IdwPredictionPoint } from './IdwMarker'
import IdwGridLayer from './IdwGridLayer'
import IdwPanel from './IdwPanel'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { IdwGridCell } from '@/lib/idw'

type Props = {
  selectedOperators?: string[]
  selectedTeknologi?: string[]
  selectedKecamatan?: string
  selectedDesa?: string
  tanggalDari?: string
  tanggalSampai?: string
  onSelectDetail?: (id: string) => void
  // IDW Mode Props
  idwMode?: boolean
  desaList?: Array<{ id: string; nama: string }>
  kecamatanList?: Array<{ id: string; nama: string }>
  userRole?: string
  userDesaId?: string | null
}

export default function SinyalMap({
  selectedOperators = [],
  selectedTeknologi = [],
  selectedKecamatan = '',
  selectedDesa = '',
  tanggalDari = '',
  tanggalSampai = '',
  onSelectDetail,
  idwMode = false,
  desaList = [],
  kecamatanList = [],
  userRole,
  userDesaId,
}: Props) {
  const [data, setData] = useState<SinyalMapItem[]>([])
  const [loading, setLoading] = useState(true)

  // IDW state
  const [idwPrediction, setIdwPrediction] = useState<IdwPredictionPoint | null>(null)
  const [idwGrid, setIdwGrid] = useState<IdwGridCell[]>([])
  const [idwGridResolution, setIdwGridResolution] = useState(200)
  const [idwGridStats, setIdwGridStats] = useState<any | null>(null)
  const [savingResult, setSavingResult] = useState(false)

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

  // Simpan hasil IDW ke riwayat sinyal
  const handleSaveIdwResult = useCallback(async (point: IdwPredictionPoint) => {
    setSavingResult(true)
    try {
      const res = await fetch('/api/sinyal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: point.latitude,
          longitude: point.longitude,
          rsrp: point.rsrp,
          rssi: point.rssi,
          rsrq: point.rsrq,
          snr: point.snr,
          // Simpan ke desa user jika ada, atau kosong
          desaKelurahanId: userDesaId || undefined,
          // Tandai sebagai estimasi IDW di catatan
          catatan: `[IDW Estimasi] p=${point.params.p}, N=${point.neighborsUsed}, r=${point.params.radius}km`,
          tanggalPengukuran: new Date().toISOString(),
        }),
      }).then((r) => r.json())

      if (res.success) {
        toast.success('Hasil prediksi IDW berhasil disimpan ke riwayat sinyal.')
      } else {
        toast.error(res.message || 'Gagal menyimpan data.')
      }
    } catch {
      toast.error('Terjadi kesalahan saat menyimpan data.')
    } finally {
      setSavingResult(false)
    }
  }, [userDesaId])

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

      {/* Kursor crosshair saat mode IDW aktif */}
      <LeafletMapBase height="calc(100vh - 280px)">
        <SinyalMarkers items={data} onSelectDetail={onSelectDetail} />
        <MapLegend showSinyal={true} showTower={false} />

        {/* IDW Layers (hanya saat idwMode aktif) */}
        {idwMode && (
          <>
            {idwGrid.length > 0 && (
              <IdwGridLayer cells={idwGrid} resolutionM={idwGridResolution} opacity={0.55} />
            )}
            {idwPrediction && (
              <IdwMarker
                point={idwPrediction}
                onSave={() => handleSaveIdwResult(idwPrediction)}
              />
            )}
            <IdwPanel
              desaList={desaList}
              kecamatanList={kecamatanList}
              selectedOperatorId={selectedOperators[0]}
              onPrediction={(point) => setIdwPrediction(point)}
              onGridResult={(cells, res, stats) => {
                setIdwGrid(cells)
                setIdwGridResolution(res)
                setIdwGridStats(stats)
              }}
              onClearGrid={() => { setIdwGrid([]); setIdwGridStats(null) }}
              onSavePoint={handleSaveIdwResult}
              userRole={userRole}
              userDesaId={userDesaId}
            />
          </>
        )}
      </LeafletMapBase>

      {/* Info bar */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Menampilkan {data.length} titik sinyal</span>
          {idwMode && idwGrid.length > 0 && idwGridStats && (
            <span className="text-purple-600 font-medium">
              + Grid IDW: {idwGridStats.validCells}/{idwGridStats.totalCells} sel
            </span>
          )}
        </div>
        <span>{idwMode ? '🧠 Mode Analisis IDW Aktif' : 'Filter waktu & operator aktif'}</span>
      </div>
    </div>
  )
}
