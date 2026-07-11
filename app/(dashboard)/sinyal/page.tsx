'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Signal, Plus, X, Download, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2, Loader2, SlidersHorizontal, RefreshCw,
  TriangleAlert, MapPin, Search, Map, List, Brain,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SignalBadge from '@/components/common/SignalBadge'
import SinyalFormDialog, { type SinyalFormData } from '@/components/forms/SinyalFormDialog'
import SinyalDetailDialog, { type SinyalDetail } from '@/components/dashboard/SinyalDetailDialog'
import { toast } from 'sonner'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
import dynamic from 'next/dynamic'

const SinyalMap = dynamic(() => import('@/components/map/SinyalMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] flex items-center justify-center text-xs text-muted-foreground">
      <Loader2 size={18} className="animate-spin mr-2" /> Memuat Peta Sinyal...
    </div>
  ),
})

type SinyalItem = {
  id: string
  latitude: number
  longitude: number
  rsrp: number | null
  rssi: number | null
  rsrq: number | null
  snr: number | null
  tanggalPengukuran: string
  catatan: string | null
  createdAt: string
  operator: { id: string; nama: string }
  teknologi: { id: string; nama: string }
  desaKelurahan: { id: string; nama: string; kecamatan: { id: string; nama: string } }
  user: { id: string; nama: string }
  foto: { id: string; url: string; keterangan: string | null }[]
}

type Meta = { total: number; page: number; page_size: number; total_pages: number }

export default function SinyalPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as 'SUPER_ADMIN' | 'PEMDES'
  const userId = (session?.user as any)?.id as string
  const userDesaId = (session?.user as any)?.desaKelurahanId as string | null

  const [items, setItems] = useState<SinyalItem[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [viewMode, setViewMode] = useState<'table' | 'map' | 'idw'>('table')

  // Filter state
  const [showFilter, setShowFilter] = useState(false)
  const [operatorList, setOperatorList] = useState<{ id: string; nama: string }[]>([])
  const [teknologiList, setTeknologiList] = useState<{ id: string; nama: string }[]>([])
  const [kecamatanList, setKecamatanList] = useState<{ id: string; nama: string }[]>([])
  const [desaList, setDesaList] = useState<{ id: string; nama: string; kecamatanId: string }[]>([])

  const [selectedOperators, setSelectedOperators] = useState<string[]>([])
  const [selectedTeknologi, setSelectedTeknologi] = useState<string[]>([])
  const [selectedKecamatan, setSelectedKecamatan] = useState('')
  const [selectedDesa, setSelectedDesa] = useState('')
  const [tanggalDari, setTanggalDari] = useState('')
  const [tanggalSampai, setTanggalSampai] = useState('')

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editData, setEditData] = useState<SinyalFormData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<SinyalDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Stats computed from current page + total
  const statsFromItems = {
    baik: items.filter(i => (i.rsrp ?? -999) > -85).length,
    sedang: items.filter(i => { const r = i.rsrp ?? -999; return r <= -85 && r >= -99 }).length,
    buruk: items.filter(i => (i.rsrp ?? -999) < -99).length,
    noData: items.filter(i => i.rsrp === null).length,
  }

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (selectedOperators.length) p.set('operator_id', selectedOperators.join(','))
    if (selectedTeknologi.length) p.set('teknologi_id', selectedTeknologi.join(','))
    if (selectedKecamatan) p.set('kecamatan_id', selectedKecamatan)
    if (selectedDesa) p.set('desa_id', selectedDesa)
    if (tanggalDari) p.set('tanggal_dari', tanggalDari)
    if (tanggalSampai) p.set('tanggal_sampai', tanggalSampai)
    return p
  }, [page, pageSize, selectedOperators, selectedTeknologi, selectedKecamatan, selectedDesa, tanggalDari, tanggalSampai])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sinyal?${buildParams()}`).then(r => r.json())
      if (res.success) {
        setItems(res.data)
        setMeta(res.meta)
      }
    } catch {
      toast.error('Gagal memuat data sinyal')
    }
    setLoading(false)
  }, [buildParams])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    Promise.all([
      fetch('/api/master/operator?page_size=50').then(r => r.json()),
      fetch('/api/master/teknologi?page_size=50').then(r => r.json()),
      fetch('/api/master/kecamatan?page_size=100').then(r => r.json()),
      fetch('/api/master/desa?page_size=500').then(r => r.json()),
    ]).then(([op, tek, kec, desa]) => {
      if (op.success) setOperatorList(op.data)
      if (tek.success) setTeknologiList(tek.data)
      if (kec.success) setKecamatanList(kec.data)
      if (desa.success) setDesaList(desa.data.map((d: any) => ({ id: d.id, nama: d.nama, kecamatanId: d.kecamatanId ?? d.kecamatan?.id })))
    })
  }, [])

  const hasFilters = selectedOperators.length > 0 || selectedTeknologi.length > 0 || selectedKecamatan || selectedDesa || tanggalDari || tanggalSampai

  const clearFilters = () => {
    setSelectedOperators([])
    setSelectedTeknologi([])
    setSelectedKecamatan('')
    setSelectedDesa('')
    setTanggalDari('')
    setTanggalSampai('')
    setPage(1)
  }

  const toggleMultiSelect = (id: string, selected: string[], setter: (v: string[]) => void) => {
    setter(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
    setPage(1)
  }

  const openDetail = async (item: SinyalItem | SinyalDetail) => {
    setDetailData(item as SinyalDetail)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/sinyal/${item.id}`).then(r => r.json())
      if (res.success) setDetailData(res.data)
    } catch {}
    setDetailLoading(false)
  }

  const openEdit = (item: SinyalItem | SinyalDetail) => {
    setEditData({
      id: item.id,
      desaKelurahanId: item.desaKelurahan.id,
      operatorId: item.operator.id,
      teknologiId: item.teknologi.id,
      latitude: item.latitude,
      longitude: item.longitude,
      rsrp: item.rsrp,
      rssi: item.rssi,
      rsrq: item.rsrq,
      snr: item.snr,
      tanggalPengukuran: item.tanggalPengukuran,
      catatan: item.catatan,
    })
    setDetailOpen(false)
    setFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data sinyal ini?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/sinyal/${id}`, { method: 'DELETE' }).then(r => r.json())
      if (res.success) {
        toast.success('Data sinyal berhasil dihapus')
        setDetailOpen(false)
        fetchData()
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    }
    setDeletingId(null)
  }

  const canEditItem = (item: SinyalItem) =>
    userRole === 'SUPER_ADMIN' || (userRole === 'PEMDES' && item.user?.id === userId)

  const canDeleteItem = (item: SinyalItem) =>
    userRole === 'SUPER_ADMIN' || (userRole === 'PEMDES' && item.user?.id === userId)

  const filteredDesa = selectedKecamatan
    ? desaList.filter(d => d.kecamatanId === selectedKecamatan)
    : desaList

  const exportCsv = () => {
    const p = buildParams()
    p.set('page_size', '10000')
    p.set('page', '1')
    // Simple CSV export from current data (server-side export endpoint preferred for large data)
    const headers = ['ID', 'Tanggal Ukur', 'Desa', 'Kecamatan', 'Operator', 'Teknologi', 'Latitude', 'Longitude', 'RSRP', 'RSSI', 'RSRQ', 'SNR', 'Catatan', 'Dibuat']
    const rows = items.map(i => [
      i.id, new Date(i.tanggalPengukuran).toLocaleDateString('id-ID'),
      i.desaKelurahan.nama, i.desaKelurahan.kecamatan.nama,
      i.operator.nama, i.teknologi.nama,
      i.latitude, i.longitude, i.rsrp ?? '', i.rssi ?? '', i.rsrq ?? '', i.snr ?? '',
      i.catatan ?? '', new Date(i.createdAt).toLocaleDateString('id-ID'),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sinyal_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Signal size={20} className="text-[var(--color-primary)]" />
            Riwayat Sinyal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {userRole === 'PEMDES'
              ? 'Pencatatan kekuatan sinyal di wilayah desa Anda'
              : 'Manajemen seluruh data pencatatan sinyal di Kabupaten Muara Enim'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center border border-[var(--color-hairline)] rounded-lg p-0.5 bg-[var(--color-surface)] shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List size={14} /> Tabel
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'map'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Map size={14} /> Peta
            </button>
            <button
              onClick={() => setViewMode('idw')}
              title="Analisis prediksi sinyal dengan algoritma IDW"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'idw'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Brain size={14} /> IDW
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs">
            <Download size={14} /> Export CSV
          </Button>
          {(userRole === 'SUPER_ADMIN' || userRole === 'PEMDES') && (
            <Button
              size="sm"
              onClick={() => { setEditData(null); setFormOpen(true) }}
              className="gap-1.5 text-xs"
            >
              <Plus size={14} /> Input Sinyal
            </Button>
          )}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total (halaman ini)', value: items.length, color: '#0075de' },
          { label: 'Sinyal Baik', value: statsFromItems.baik, color: '#22c55e' },
          { label: 'Sinyal Sedang', value: statsFromItems.sedang, color: '#eab308' },
          { label: 'Sinyal Buruk', value: statsFromItems.buruk, color: '#ef4444' },
        ].map(s => (
          <div
            key={s.label}
            className="flex flex-col px-4 py-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-soft"
          >
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="text-xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <Card className="border-hairline shadow-soft">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[160px] relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <span className="text-xs text-muted-foreground pl-9 py-2 block">Filter menggunakan panel di bawah</span>
            </div>
            <button
              onClick={() => setShowFilter(prev => !prev)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
                showFilter || hasFilters
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'border-[var(--color-hairline)] text-muted-foreground hover:bg-[var(--color-canvas-soft)]'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filter
              {hasFilters && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-[var(--color-primary)] text-white font-bold">
                  {selectedOperators.length + selectedTeknologi.length + (selectedKecamatan ? 1 : 0) + (selectedDesa ? 1 : 0) + (tanggalDari ? 1 : 0) + (tanggalSampai ? 1 : 0)}
                </span>
              )}
            </button>
            <Button size="sm" variant="ghost" onClick={fetchData} className="text-xs gap-1.5 px-3">
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Muat ulang</span>
            </Button>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                <X size={13} /> Hapus filter
              </button>
            )}
          </div>

          {/* Expanded filter panel */}
          {showFilter && (
            <div className="border-t border-[var(--color-hairline)] pt-3 space-y-3">
              {/* Admin-only: Kecamatan & Desa filter */}
              {userRole === 'SUPER_ADMIN' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Kecamatan</label>
                    <select
                      value={selectedKecamatan}
                      onChange={e => { setSelectedKecamatan(e.target.value); setSelectedDesa(''); setPage(1) }}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">Semua Kecamatan</option>
                      {kecamatanList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Desa/Kelurahan</label>
                    <select
                      value={selectedDesa}
                      onChange={e => { setSelectedDesa(e.target.value); setPage(1) }}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    >
                      <option value="">Semua Desa</option>
                      {filteredDesa.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Operator (multi-select chips) */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Operator</label>
                <div className="flex flex-wrap gap-1.5">
                  {operatorList.map(op => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => toggleMultiSelect(op.id, selectedOperators, setSelectedOperators)}
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

              {/* Teknologi (multi-select chips) */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Teknologi</label>
                <div className="flex flex-wrap gap-1.5">
                  {teknologiList.map(tek => (
                    <button
                      key={tek.id}
                      type="button"
                      onClick={() => toggleMultiSelect(tek.id, selectedTeknologi, setSelectedTeknologi)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        selectedTeknologi.includes(tek.id)
                          ? 'bg-[var(--color-accent-teal)] text-white border-[var(--color-accent-teal)]'
                          : 'bg-[var(--color-canvas-soft)] text-muted-foreground border-[var(--color-hairline)] hover:border-[var(--color-accent-teal)]'
                      }`}
                    >
                      {tek.nama}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rentang Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tanggal Dari</label>
                  <Input
                    type="date"
                    value={tanggalDari}
                    onChange={e => { setTanggalDari(e.target.value); setPage(1) }}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tanggal Sampai</label>
                  <Input
                    type="date"
                    value={tanggalSampai}
                    onChange={e => { setTanggalSampai(e.target.value); setPage(1) }}
                    className="text-sm"
                  />
                </div>
              </div>

              {!tanggalDari && !tanggalSampai && (
                <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-[var(--color-warning-light)] border border-yellow-200">
                  <TriangleAlert size={13} className="text-[var(--color-warning)] shrink-0" />
                  <p className="text-xs text-[var(--color-warning)]">Data default dibatasi 6 bulan terakhir. Pilih rentang tanggal untuk melihat data lebih lama.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table vs Map vs IDW View */}
      {viewMode === 'map' || viewMode === 'idw' ? (
        <SinyalMap
          selectedOperators={selectedOperators}
          selectedTeknologi={selectedTeknologi}
          selectedKecamatan={selectedKecamatan}
          selectedDesa={selectedDesa}
          tanggalDari={tanggalDari}
          tanggalSampai={tanggalSampai}
          idwMode={viewMode === 'idw'}
          desaList={desaList}
          kecamatanList={kecamatanList}
          userRole={userRole}
          userDesaId={userDesaId}
          onSelectKecamatan={(id) => {
            setSelectedKecamatan(id)
            setSelectedDesa('')
            setPage(1)
          }}
          onSelectDesa={(id) => {
            setSelectedDesa(id)
            setPage(1)
          }}
          onSelectDetail={(id) => {
            const found = items.find(i => i.id === id)
            if (found) openDetail(found)
            else fetch(`/api/sinyal/${id}`).then(r => r.json()).then(res => { if (res.success) openDetail(res.data) })
          }}
        />
      ) : (
        <Card className="border-hairline shadow-soft overflow-hidden">
        <CardHeader className="px-5 py-4 border-b border-[var(--color-hairline)] flex-row items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            {loading ? 'Memuat data...' : `${meta?.total ?? 0} data ditemukan`}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Tampilkan</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              className="text-xs px-2 py-1 border border-[var(--color-hairline)] rounded-md bg-[var(--color-surface)] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-muted-foreground hidden sm:inline">data</span>
          </div>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Signal size={32} className="opacity-20 mb-3" />
            <p className="text-sm font-medium">Belum ada data sinyal</p>
            <p className="text-xs mt-1">
              {hasFilters ? 'Coba ubah atau hapus filter yang aktif' : 'Klik "Input Sinyal" untuk mulai mencatat'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-canvas-soft)]">
                    {[
                      'Tanggal Ukur',
                      ...(userRole === 'SUPER_ADMIN' ? ['Desa / Kecamatan'] : []),
                      'Operator', 'Teknologi', 'RSRP', 'RSSI', 'Koordinat', 'Foto', 'Aksi'
                    ].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`border-t border-[var(--color-hairline)] hover:bg-[var(--color-canvas-soft)] transition-colors ${
                        idx % 2 === 1 ? 'bg-[var(--color-canvas-soft)]/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {new Date(item.tanggalPengukuran).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <div className="text-muted-foreground">
                          {new Date(item.tanggalPengukuran).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      {userRole === 'SUPER_ADMIN' && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs">{item.desaKelurahan.nama}</div>
                          <div className="text-xs text-muted-foreground">{item.desaKelurahan.kecamatan.nama}</div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs">{item.operator.nama}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] font-medium">
                          {item.teknologi.nama}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <SignalBadge rsrp={item.rsrp} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.rssi !== null ? `${item.rssi} dBm` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        <a
                          href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                        >
                          <MapPin size={11} />
                          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs text-center">
                        {item.foto.length > 0
                          ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-bold">{item.foto.length}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDetail(item)}
                            className="p-1.5 rounded-md hover:bg-[var(--color-canvas-soft)] text-muted-foreground hover:text-[var(--color-primary)] transition-colors"
                            title="Lihat detail"
                          >
                            <Eye size={14} />
                          </button>
                          {canEditItem(item) && (
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-md hover:bg-[var(--color-canvas-soft)] text-muted-foreground hover:text-[var(--color-accent-teal)] transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDeleteItem(item) && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Hapus"
                            >
                              {deletingId === item.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[var(--color-hairline)]">
              {items.map(item => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-[var(--color-canvas-soft)] transition-colors cursor-pointer"
                  onClick={() => openDetail(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground">
                        {item.operator.nama}
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">({item.teknologi.nama})</span>
                      </div>
                      {userRole === 'SUPER_ADMIN' && (
                        <div className="text-xs text-muted-foreground mt-0.5">{item.desaKelurahan.nama} — {item.desaKelurahan.kecamatan.nama}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(item.tanggalPengukuran).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <SignalBadge rsrp={item.rsrp} size="sm" />
                    </div>
                  </div>
                  {item.foto.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">{item.foto.length} foto</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {meta && meta.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]">
            <span className="text-xs text-muted-foreground">
              Halaman {meta.page} dari {meta.total_pages} ({meta.total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={meta.page === 1}
                className="p-1.5 rounded-md border border-[var(--color-hairline)] disabled:opacity-40 hover:bg-white transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, meta.total_pages) }, (_, i) => {
                let p: number
                if (meta.total_pages <= 5) {
                  p = i + 1
                } else if (meta.page <= 3) {
                  p = i + 1
                } else if (meta.page >= meta.total_pages - 2) {
                  p = meta.total_pages - 4 + i
                } else {
                  p = meta.page - 2 + i
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded-md border transition-colors ${
                      p === meta.page
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'border-[var(--color-hairline)] hover:bg-white text-muted-foreground'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(meta.total_pages, p + 1))}
                disabled={meta.page === meta.total_pages}
                className="p-1.5 rounded-md border border-[var(--color-hairline)] disabled:opacity-40 hover:bg-white transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>
      )}

      {/* Dialogs */}
      <SinyalFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null) }}
        onSuccess={fetchData}
        editData={editData}
        userRole={userRole}
        userDesaId={userDesaId}
      />

      <SinyalDetailDialog
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailData(null) }}
        data={detailData}
        loading={detailLoading}
        canEdit={detailData ? canEditItem(detailData) : false}
        canDelete={detailData ? canDeleteItem(detailData) : false}
        onEdit={() => detailData && openEdit(detailData)}
        onDelete={() => detailData && handleDelete(detailData.id)}
        onPhotoDeleted={(fotoId) => {
          setDetailData(prev => prev ? { ...prev, foto: prev.foto.filter(f => f.id !== fotoId) } : prev)
        }}
        onPhotoAdded={() => {
          if (detailData) openDetail(detailData)
        }}
      />
    </div>
  )
}
