'use client'

import React, { useState, useCallback } from 'react'
import { useMapEvents } from 'react-leaflet'
import {
  Brain, Crosshair, ChevronDown, ChevronUp, Loader2, X,
  Info, Sliders, TriangleAlert, Save, LayoutGrid, Target,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { IdwGridCell } from '@/lib/idw'
import type { IdwPredictionPoint } from './IdwMarker'

// ─── Types ────────────────────────────────────────────────────────────────────

type IdwParams = {
  p: number
  n: number
  radius: number
}

type GridConfig = {
  desaKelurahanId?: string
  kecamatanId?: string
  resolutionM: number
}

type Props = {
  desaList?: Array<{ id: string; nama: string }>
  kecamatanList?: Array<{ id: string; nama: string }>
  operatorList?: Array<{ id: string; nama: string }>
  selectedOperatorId?: string
  onPrediction: (point: IdwPredictionPoint) => void
  onGridResult: (cells: IdwGridCell[], resolutionM: number, stats: any) => void
  onClearGrid: () => void
  onSavePoint?: (point: IdwPredictionPoint) => void
  userRole?: string
  userDesaId?: string | null
}

// ─── Click Coordinate Capture ─────────────────────────────────────────────────

type ClickCaptureProps = {
  active: boolean
  onCoord: (lat: number, lng: number) => void
}

function ClickCapture({ active, onCoord }: ClickCaptureProps) {
  useMapEvents({
    click(e) {
      if (active) {
        onCoord(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

// ─── Sub Component: ParamRow ──────────────────────────────────────────────────

function ParamRow({
  label, desc, value, min, max, step = 1, unit, onChange,
}: {
  label: string; desc: string; value: number; min: number; max: number; step?: number
  unit: string; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{label}</label>
        <span className="text-[11px] font-mono font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-1.5 py-0.5 rounded">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-[var(--color-primary)] cursor-pointer"
      />
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IdwPanel({
  desaList = [],
  kecamatanList = [],
  operatorList = [],
  selectedOperatorId,
  onPrediction,
  onGridResult,
  onClearGrid,
  onSavePoint,
  userRole,
  userDesaId,
}: Props) {
  // State panel
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState<'single' | 'grid'>('single')

  // Click capture mode
  const [clickMode, setClickMode] = useState(false)

  // Koordinat target (single)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  // IDW params
  const [params, setParams] = useState<IdwParams>({ p: 2, n: 20, radius: 5 })

  // Grid config
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    desaKelurahanId: userDesaId ?? undefined,
    kecamatanId: undefined,
    resolutionM: 200,
  })

  // Loading states
  const [loadingSingle, setLoadingSingle] = useState(false)
  const [loadingGrid, setLoadingGrid] = useState(false)

  // Hasil terakhir (single)
  const [lastResult, setLastResult] = useState<IdwPredictionPoint | null>(null)
  const [gridStats, setGridStats] = useState<any | null>(null)

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCoordCapture = useCallback((lat: number, lng: number) => {
    setLatitude(lat.toFixed(6))
    setLongitude(lng.toFixed(6))
    setClickMode(false)
    setLastResult(null)
    toast.info(`Koordinat dipilih: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }, [])

  const handleSinglePredict = async () => {
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Masukkan koordinat yang valid atau klik titik di peta.')
      return
    }

    setLoadingSingle(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/sinyal/predict-idw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          operatorId: selectedOperatorId || undefined,
          ...params,
        }),
      }).then((r) => r.json())

      if (!res.success) {
        toast.error(res.message || 'Gagal menghitung prediksi IDW.')
        return
      }

      const point: IdwPredictionPoint = {
        latitude: lat,
        longitude: lng,
        rsrp: res.data.predictions.rsrp,
        rssi: res.data.predictions.rssi,
        rsrq: res.data.predictions.rsrq,
        snr: res.data.predictions.snr,
        neighborsUsed: res.data.stats.neighborsUsed,
        warning: res.data.warning,
        params: { p: params.p, n: params.n, radius: params.radius },
      }
      setLastResult(point)
      onPrediction(point)

      if (res.data.warning) {
        toast.warning(res.data.warning, { duration: 5000 })
      } else {
        toast.success(`Prediksi selesai. ${res.data.stats.neighborsUsed} titik historis digunakan.`)
      }
    } catch {
      toast.error('Terjadi kesalahan saat menghitung prediksi.')
    } finally {
      setLoadingSingle(false)
    }
  }

  const handleGridGenerate = async () => {
    if (!gridConfig.desaKelurahanId && !gridConfig.kecamatanId) {
      toast.error('Pilih Desa atau Kecamatan terlebih dahulu untuk generate peta area.')
      return
    }

    setLoadingGrid(true)
    onClearGrid()
    try {
      const res = await fetch('/api/sinyal/predict-idw-grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desaKelurahanId: gridConfig.desaKelurahanId,
          kecamatanId: gridConfig.kecamatanId,
          operatorId: selectedOperatorId || undefined,
          resolutionM: gridConfig.resolutionM,
          ...params,
        }),
      }).then((r) => r.json())

      if (!res.success) {
        toast.error(res.message || 'Gagal generate peta IDW.')
        return
      }

      setGridStats(res.data.stats)
      onGridResult(res.data.grid, res.data.params.resolutionM, res.data.stats)

      if (res.data.warning) {
        toast.warning(res.data.warning, { duration: 6000 })
      } else {
        toast.success(
          `Grid IDW selesai: ${res.data.stats.totalCells} sel, ${res.data.stats.validCells} terisi.`,
        )
      }
    } catch {
      toast.error('Terjadi kesalahan saat generate peta IDW.')
    } finally {
      setLoadingGrid(false)
    }
  }

  const handleSave = () => {
    if (lastResult && onSavePoint) {
      onSavePoint(lastResult)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <ClickCapture active={clickMode} onCoord={handleCoordCapture} />

      {/* Floating Panel */}
      <div
        className="absolute top-3 left-3 z-[450] w-72 bg-white/98 dark:bg-gray-900/98 backdrop-blur-md rounded-2xl border border-[var(--color-hairline)] shadow-elevated overflow-hidden"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white">
          <div className="flex items-center gap-2">
            <Brain size={16} />
            <span className="text-xs font-bold tracking-tight">Analisis IDW</span>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-0.5 rounded hover:bg-white/20 transition-colors"
          >
            {isMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {!isMinimized && (
          <>
            {/* Tab Switcher */}
            <div className="flex border-b border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]">
              {[
                { key: 'single', icon: Target, label: 'Titik Tunggal' },
                { key: 'grid', icon: LayoutGrid, label: 'Peta Area' },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors ${
                    activeTab === key
                      ? 'text-purple-600 border-b-2 border-purple-600 bg-white dark:bg-gray-900'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>

            <div className="p-3.5 space-y-3 max-h-[65vh] overflow-y-auto">
              {/* ── Tab: Titik Tunggal ─── */}
              {activeTab === 'single' && (
                <>
                  {/* Koordinat Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        Koordinat Target
                      </label>
                      <button
                        onClick={() => {
                          setClickMode(!clickMode)
                          toast.info(
                            clickMode ? 'Mode klik dinonaktifkan.' : 'Klik titik di peta untuk memilih koordinat.',
                            { duration: 2500 },
                          )
                        }}
                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          clickMode
                            ? 'bg-purple-100 text-purple-700 border-purple-300 font-bold animate-pulse'
                            : 'text-gray-500 border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <Crosshair size={11} />
                        {clickMode ? 'Klik Peta...' : 'Klik di Peta'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Latitude</label>
                        <input
                          type="number"
                          value={latitude}
                          onChange={(e) => { setLatitude(e.target.value); setLastResult(null) }}
                          placeholder="-3.75412"
                          step="0.00001"
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Longitude</label>
                        <input
                          type="number"
                          value={longitude}
                          onChange={(e) => { setLongitude(e.target.value); setLastResult(null) }}
                          placeholder="103.7423"
                          step="0.00001"
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Parameter IDW */}
                  <IdwParamsSection params={params} setParams={setParams} />

                  {/* Tombol Hitung */}
                  <button
                    onClick={handleSinglePredict}
                    disabled={loadingSingle || !latitude || !longitude}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                  >
                    {loadingSingle ? (
                      <><Loader2 size={14} className="animate-spin" /> Menghitung...</>
                    ) : (
                      <><Brain size={14} /> Hitung Prediksi IDW</>
                    )}
                  </button>

                  {/* Hasil Prediksi */}
                  {lastResult && (
                    <div className="space-y-2 pt-1 border-t border-[var(--color-hairline)]">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
                        <CheckCircle2 size={13} /> Hasil Prediksi
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        {[
                          { label: 'RSRP', value: lastResult.rsrp, unit: 'dBm' },
                          { label: 'RSSI', value: lastResult.rssi, unit: 'dBm' },
                          { label: 'RSRQ', value: lastResult.rsrq, unit: 'dBm' },
                          { label: 'SNR', value: lastResult.snr, unit: 'dB' },
                        ].map(({ label, value, unit }) => (
                          <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-center">
                            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
                            <p className="font-bold text-gray-800 dark:text-gray-100">
                              {value !== null ? `${Math.round((value ?? 0) * 10) / 10} ${unit}` : '—'}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] text-gray-500 bg-purple-50 rounded-lg px-2.5 py-1.5">
                        Menggunakan <strong>{lastResult.neighborsUsed}</strong> titik historis terdekat
                      </div>

                      {lastResult.warning && (
                        <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                          <TriangleAlert size={11} className="mt-0.5 shrink-0" />
                          {lastResult.warning}
                        </div>
                      )}

                      {onSavePoint && (
                        <button
                          onClick={handleSave}
                          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg border-2 border-purple-200 hover:bg-purple-50 text-purple-700 text-xs font-semibold transition-colors"
                        >
                          <Save size={13} /> Simpan ke Riwayat Sinyal
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Tab: Peta Area ─── */}
              {activeTab === 'grid' && (
                <>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700 flex gap-1.5">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    Grid dihitung per wilayah. Semakin kecil resolusi sel, semakin lama proses. Dibatasi maks 2500 sel.
                  </div>

                  {/* Pilih Area */}
                  <div className="space-y-1.5">
                    {userRole === 'SUPER_ADMIN' && kecamatanList.length > 0 && (
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 block mb-0.5">Kecamatan</label>
                        <select
                          value={gridConfig.kecamatanId ?? ''}
                          onChange={(e) => setGridConfig(c => ({ ...c, kecamatanId: e.target.value || undefined, desaKelurahanId: undefined }))}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-purple-400"
                        >
                          <option value="">-- Pilih Kecamatan --</option>
                          {kecamatanList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
                        </select>
                      </div>
                    )}
                    {desaList.length > 0 && (
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 block mb-0.5">Desa</label>
                        <select
                          value={gridConfig.desaKelurahanId ?? ''}
                          onChange={(e) => setGridConfig(c => ({ ...c, desaKelurahanId: e.target.value || undefined, kecamatanId: undefined }))}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-purple-400"
                        >
                          <option value="">-- Pilih Desa --</option>
                          {desaList.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Resolusi Grid */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">Resolusi Sel</label>
                      <span className="text-[11px] font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        {gridConfig.resolutionM}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={1000}
                      step={50}
                      value={gridConfig.resolutionM}
                      onChange={(e) => setGridConfig(c => ({ ...c, resolutionM: Number(e.target.value) }))}
                      className="w-full h-1.5 accent-purple-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-gray-400">
                      <span>100m (detail)</span>
                      <span>1000m (cepat)</span>
                    </div>
                    <p className="text-[10px] text-gray-400">Ukuran tiap sel grid. Lebih kecil = lebih detail tapi lebih lama dihitung.</p>
                  </div>

                  {/* Parameter IDW */}
                  <IdwParamsSection params={params} setParams={setParams} />

                  {/* Tombol Generate */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleGridGenerate}
                      disabled={loadingGrid || (!gridConfig.desaKelurahanId && !gridConfig.kecamatanId)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
                    >
                      {loadingGrid ? (
                        <><Loader2 size={13} className="animate-spin" /> Generating...</>
                      ) : (
                        <><LayoutGrid size={13} /> Generate Peta Area</>
                      )}
                    </button>
                    <button
                      onClick={() => { onClearGrid(); setGridStats(null) }}
                      title="Hapus grid"
                      className="px-2.5 py-2 rounded-xl border border-[var(--color-hairline)] hover:bg-red-50 hover:border-red-200 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Stats Grid */}
                  {gridStats && (
                    <div className="space-y-1.5 pt-1 border-t border-[var(--color-hairline)]">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
                        <CheckCircle2 size={12} /> Peta Area Selesai
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                        {[
                          { label: 'Total Sel', value: gridStats.totalCells },
                          { label: 'Terisi', value: gridStats.validCells },
                          { label: 'Data Historis', value: gridStats.historicalDataUsed },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg py-1.5">
                            <p className="text-gray-400 text-[9px] font-semibold uppercase">{label}</p>
                            <p className="font-bold text-gray-800 dark:text-gray-200">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Disclaimer */}
              <div className="flex items-start gap-1.5 text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-2">
                <Info size={11} className="mt-0.5 shrink-0 text-purple-400" />
                Hasil IDW adalah estimasi. Bukan data resmi pengukuran lapangan.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Sub Component: IDW Parameters Section ───────────────────────────────────

function IdwParamsSection({
  params, setParams,
}: {
  params: IdwParams
  setParams: React.Dispatch<React.SetStateAction<IdwParams>>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-[var(--color-hairline)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-canvas-soft)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
          <Sliders size={12} className="text-purple-500" />
          Parameter IDW
        </div>
        {expanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          <ParamRow
            label="Power Parameter (p)"
            desc="Mengontrol seberapa kuat pengaruh jarak. p=2 = kuadrat terbalik (standar). Nilai lebih tinggi = titik terdekat lebih dominan."
            value={params.p}
            min={1}
            max={5}
            step={0.5}
            unit=""
            onChange={(v) => setParams(c => ({ ...c, p: v }))}
          />
          <ParamRow
            label="Tetangga Maksimum (N)"
            desc="Jumlah maksimum titik historis terdekat yang digunakan. Sistem akan mengambil sebanyak data yang tersedia (maks N)."
            value={params.n}
            min={3}
            max={50}
            step={1}
            unit="titik"
            onChange={(v) => setParams(c => ({ ...c, n: v }))}
          />
          <ParamRow
            label="Radius Pencarian"
            desc="Jarak maksimum (km) untuk mencari data historis dari titik target. Data di luar radius tidak digunakan."
            value={params.radius}
            min={0.5}
            max={15}
            step={0.5}
            unit="km"
            onChange={(v) => setParams(c => ({ ...c, radius: v }))}
          />
        </div>
      )}
    </div>
  )
}
