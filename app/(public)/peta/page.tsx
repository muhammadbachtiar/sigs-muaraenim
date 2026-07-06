'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Signal, SlidersHorizontal, RefreshCw, X, Loader2, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const PublicSinyalMap = dynamic(() => import('@/components/map/PublicSinyalMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[calc(100vh-150px)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] flex items-center justify-center text-xs text-muted-foreground">
      <Loader2 size={18} className="animate-spin mr-2 text-[var(--color-primary)]" /> Memuat Peta Sinyal Publik...
    </div>
  ),
})

type Option = { id: string; nama: string }

export default function PetaPublikPage() {
  const [kecamatanList, setKecamatanList] = useState<Option[]>([])
  const [desaList, setDesaList] = useState<Option[]>([])
  const [operatorList, setOperatorList] = useState<Option[]>([])

  const [selectedKecamatan, setSelectedKecamatan] = useState('')
  const [selectedDesa, setSelectedDesa] = useState('')
  const [selectedOperators, setSelectedOperators] = useState<string[]>([])
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')

  const [showFilter, setShowFilter] = useState(false)
  const [loadingDesa, setLoadingDesa] = useState(false)

  // Fetch Kecamatan & Operator on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/master/kecamatan?is_select=true').then(r => r.json()),
      fetch('/api/master/operator?is_select=true').then(r => r.json()),
    ]).then(([kec, op]) => {
      if (kec.success) setKecamatanList(kec.data)
      if (op.success) setOperatorList(op.data)
    })
  }, [])

  // Fetch Desa when Kecamatan changes
  useEffect(() => {
    if (!selectedKecamatan) {
      setDesaList([])
      setSelectedDesa('')
      return
    }

    setLoadingDesa(true)
    fetch(`/api/master/desa?is_select=true&kecamatan_id=${selectedKecamatan}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setDesaList(res.data)
      })
      .finally(() => setLoadingDesa(false))
  }, [selectedKecamatan])

  const toggleOperator = (id: string) => {
    setSelectedOperators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const resetFilters = () => {
    setSelectedKecamatan('')
    setSelectedDesa('')
    setSelectedOperators([])
    setTanggalDari('')
    setTanggalSampai('')
  }

  const hasOptionalFilters = selectedOperators.length > 0 || tanggalDari !== '' || tanggalSampai !== ''

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Signal size={22} className="text-[var(--color-primary)]" />
            Peta Sebaran Sinyal Publik
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Informasi kekuatan sinyal seluler berdasarkan hasil pengukuran lapangan di Kabupaten Muara Enim
          </p>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilter(prev => !prev)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showFilter || hasOptionalFilters
              ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)] font-semibold'
              : 'border-[var(--color-hairline)] text-muted-foreground hover:bg-[var(--color-canvas-soft)]'
          }`}
        >
          <SlidersHorizontal size={14} />
          Filter Tambahan
        </button>
      </div>

      {/* Main Filter Toolbar (Wajib: Kecamatan & Desa) */}
      <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-soft space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Select Kecamatan */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Kecamatan <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedKecamatan}
              onChange={e => {
                setSelectedKecamatan(e.target.value)
                setSelectedDesa('')
              }}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="">-- Pilih Kecamatan --</option>
              {kecamatanList.map(k => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>

          {/* Select Desa */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Desa / Kelurahan <span className="text-red-500">*</span>
            </label>
            <select
              disabled={!selectedKecamatan || loadingDesa}
              value={selectedDesa}
              onChange={e => setSelectedDesa(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
            >
              <option value="">
                {!selectedKecamatan
                  ? '-- Pilih Kecamatan Dulu --'
                  : loadingDesa
                  ? 'Memuat desa...'
                  : '-- Pilih Desa/Kelurahan --'}
              </option>
              {desaList.map(d => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </div>

          {/* Status Indicator / Clear */}
          <div className="flex items-end justify-between sm:justify-end gap-2">
            {(selectedKecamatan || selectedDesa) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-xs text-red-500 hover:text-red-600 gap-1 h-9"
              >
                <X size={14} /> Reset Lokasi
              </Button>
            )}
          </div>
        </div>

        {/* Optional Filter Panel (Expanded) */}
        {showFilter && (
          <div className="border-t border-[var(--color-hairline)] pt-3 space-y-3">
            {/* Operator Chips */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Operator Seluler</label>
              <div className="flex flex-wrap gap-1.5">
                {operatorList.map(op => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => toggleOperator(op.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      selectedOperators.includes(op.id)
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-[var(--color-canvas-soft)] text-muted-foreground border-[var(--color-hairline)] hover:border-[var(--color-primary)]'
                    }`}
                  >
                    {op.nama}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Tanggal Dari</label>
                <Input
                  type="date"
                  value={tanggalDari}
                  onChange={e => setTanggalDari(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Tanggal Sampai</label>
                <Input
                  type="date"
                  value={tanggalSampai}
                  onChange={e => setTanggalSampai(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Content */}
      <PublicSinyalMap
        selectedKecamatanId={selectedKecamatan}
        selectedDesaId={selectedDesa}
        selectedOperators={selectedOperators}
        tanggalDari={tanggalDari}
        tanggalSampai={tanggalSampai}
      />
    </div>
  )
}
