'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import {
  Users, Search, Building2, MapPin, Map, Pencil, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown, Check, X, Coins, HeartPulse, GraduationCap, Store, Briefcase, FileText,
  TriangleAlert
} from 'lucide-react'
import { toast } from 'sonner'

const DesaDetailMap = dynamic(() => import('@/components/map/DesaDetailMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] rounded-xl border border-hairline bg-[var(--color-canvas-soft)] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
    </div>
  ),
})

const MapCoordinatePicker = dynamic(() => import('@/components/map/MapCoordinatePicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] rounded-xl border border-hairline bg-[var(--color-canvas-soft)] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
    </div>
  ),
})

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type DemografiData = {
  desaKelurahanId: string
  jumlahPenduduk: number | null
  usiaProduktif: number | null
  kepadatan: number | null
  mataPencaharianUtama: string | null
  rataRataPenghasilan: number | null
  saranaKesehatan: boolean
  saranaPendidikan: boolean
  pasar: boolean
  kegiatanEkonomi: string | null
  catatan: string | null
  updatedAt: string | null
  desaKelurahan: {
    id: string
    nama: string
    tipe: 'DESA' | 'KELURAHAN'
    kodeDesa: string | null
    latitude: number | null
    longitude: number | null
    kecamatan: {
      nama: string
    }
  }
}

type DesaListItem = {
  id: string
  nama: string
  tipe: 'DESA' | 'KELURAHAN'
  kodeDesa: string | null
  latitude: number | null
  longitude: number | null
  kecamatanId: string
  kecamatan: {
    id: string
    nama: string
  }
  demografi: {
    jumlahPenduduk: number | null
    usiaProduktif: number | null
    kepadatan: number | null
    mataPencaharianUtama: string | null
    rataRataPenghasilan: number | null
    saranaKesehatan: boolean
    saranaPendidikan: boolean
    pasar: boolean
    kegiatanEkonomi: string | null
    catatan: string | null
    updatedAt: string | null
  } | null
}

type KecamatanItem = {
  id: string
  nama: string
  kode: string
}

export default function DemografiPage() {
  const { data: session, status } = useSession()
  const user = session?.user as any

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const userDesaId = user?.desaKelurahanId

  // --- PEMDES STATE ---
  const [pemdesData, setPemdesData] = useState<DemografiData | null>(null)
  const [pemdesLoading, setPemdesLoading] = useState(true)

  // --- SUPER ADMIN STATE ---
  const [desaList, setDesaList] = useState<DesaListItem[]>([])
  const [totalDesa, setTotalDesa] = useState(0)
  const [adminLoading, setAdminLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedKecamatanIds, setSelectedKecamatanIds] = useState<string[]>([])

  // --- FILTER STATE ---
  const [allKecamatans, setAllKecamatans] = useState<KecamatanItem[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filterKecSearch, setFilterKecSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // --- EDIT MODAL STATE ---
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [activeDesaId, setActiveDesaId] = useState<string | null>(null)
  const [activeDesaNama, setActiveDesaNama] = useState('')
  const [activeDesaKecamatan, setActiveDesaKecamatan] = useState('')

  // Edit Form Fields
  const [jumlahPenduduk, setJumlahPenduduk] = useState('')
  const [usiaProduktif, setUsiaProduktif] = useState('')
  const [kepadatan, setKepadatan] = useState('')
  const [mataPencaharianUtama, setMataPencaharianUtama] = useState('')
  const [rataRataPenghasilan, setRataRataPenghasilan] = useState('')
  const [saranaKesehatan, setSaranaKesehatan] = useState(false)
  const [saranaPendidikan, setSaranaPendidikan] = useState(false)
  const [pasar, setPasar] = useState(false)
  const [kegiatanEkonomi, setKegiatanEkonomi] = useState('')
  const [catatan, setCatatan] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showMapPickerModal, setShowMapPickerModal] = useState(false)

  // --- DETAIL MODAL STATE (Super Admin) ---
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailData, setDetailData] = useState<DemografiData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Debounced search timer
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch all kecamatan (for filtering)
  useEffect(() => {
    async function loadKecamatans() {
      try {
        const res = await fetch('/api/master/kecamatan?page_size=100').then(r => r.json())
        if (res.success) setAllKecamatans(res.data)
      } catch (err) {
        console.error('Failed to load kecamatan options', err)
      }
    }
    loadKecamatans()
  }, [])

  // Handle click outside for multi-select dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- FETCH DATA FOR PEMDES ---
  const fetchPemdesData = useCallback(async () => {
    if (!userDesaId) return
    setPemdesLoading(true)
    try {
      const res = await fetch(`/api/demografi/${userDesaId}`).then(r => r.json())
      if (res.success) {
        setPemdesData(res.data)
      } else {
        toast.error(res.message || 'Gagal memuat data demografi')
      }
    } catch {
      toast.error('Gagal menghubungi server')
    } finally {
      setPemdesLoading(false)
    }
  }, [userDesaId])

  useEffect(() => {
    if (status === 'authenticated' && !isSuperAdmin) {
      fetchPemdesData()
    }
  }, [status, isSuperAdmin, fetchPemdesData])

  // --- FETCH DATA FOR SUPER ADMIN ---
  const fetchAdminData = useCallback(async (query: string, pageNum: number, kecIds: string[]) => {
    setAdminLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        page_size: '10'
      })
      if (query) params.set('search', query)
      if (kecIds.length > 0) params.set('kecamatan_id', kecIds.join(','))

      const res = await fetch(`/api/master/desa?${params}`).then(r => r.json())
      if (res.success) {
        setDesaList(res.data)
        setTotalDesa(res.meta.total)
        setTotalPages(res.meta.total_pages)
      }
    } catch (err) {
      console.error('Failed to load desa list', err)
    } finally {
      setAdminLoading(false)
    }
  }, [])

  // Fetch when search, page, or filters change
  useEffect(() => {
    if (status === 'authenticated' && isSuperAdmin) {
      fetchAdminData(searchQuery, page, selectedKecamatanIds)
    }
  }, [status, isSuperAdmin, page, selectedKecamatanIds, fetchAdminData])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetchAdminData(val, 1, selectedKecamatanIds)
    }, 350)
  }

  // --- LOAD DEMOGRAFI FOR EDIT ---
  const loadForEdit = async (desaId: string, name: string, kecamatanName: string) => {
    setFormError('')
    setActiveDesaId(desaId)
    setActiveDesaNama(name)
    setActiveDesaKecamatan(kecamatanName)

    // Fetch demografi first
    try {
      const res = await fetch(`/api/demografi/${desaId}`).then(r => r.json())
      if (res.success) {
        const d = res.data
        setJumlahPenduduk(d.jumlahPenduduk != null ? String(d.jumlahPenduduk) : '')
        setUsiaProduktif(d.usiaProduktif != null ? String(d.usiaProduktif) : '')
        setKepadatan(d.kepadatan != null ? String(d.kepadatan) : '')
        setMataPencaharianUtama(d.mataPencaharianUtama || '')
        setRataRataPenghasilan(d.rataRataPenghasilan != null ? String(d.rataRataPenghasilan) : '')
        setSaranaKesehatan(d.saranaKesehatan)
        setSaranaPendidikan(d.saranaPendidikan)
        setPasar(d.pasar)
        setKegiatanEkonomi(d.kegiatanEkonomi || '')
        setCatatan(d.catatan || '')
        setLatitude(d.desaKelurahan?.latitude != null ? String(d.desaKelurahan.latitude) : '')
        setLongitude(d.desaKelurahan?.longitude != null ? String(d.desaKelurahan.longitude) : '')
      }
    } catch {
      toast.error('Gagal mengambil data ter-update')
    }
    setEditModalOpen(true)
  }

  // --- SUBMIT EDIT ---
  const handleEditSubmit = async () => {
    if (!activeDesaId) return
    setFormError('')
    setSubmitting(true)

    const payload = {
      jumlahPenduduk: jumlahPenduduk ? parseInt(jumlahPenduduk, 10) : null,
      usiaProduktif: usiaProduktif ? parseInt(usiaProduktif, 10) : null,
      kepadatan: kepadatan ? parseFloat(kepadatan) : null,
      mataPencaharianUtama: mataPencaharianUtama.trim() || null,
      rataRataPenghasilan: rataRataPenghasilan ? parseInt(rataRataPenghasilan, 10) : null,
      saranaKesehatan,
      saranaPendidikan,
      pasar,
      kegiatanEkonomi: kegiatanEkonomi.trim() || null,
      catatan: catatan.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    }

    if (payload.jumlahPenduduk != null && payload.jumlahPenduduk < 0) {
      setFormError('Jumlah Penduduk tidak boleh bernilai negatif.')
      setSubmitting(false)
      return
    }
    if (payload.usiaProduktif != null && payload.usiaProduktif < 0) {
      setFormError('Usia Produktif tidak boleh bernilai negatif.')
      setSubmitting(false)
      return
    }
    if (payload.kepadatan != null && payload.kepadatan < 0) {
      setFormError('Kepadatan Penduduk tidak boleh bernilai negatif.')
      setSubmitting(false)
      return
    }
    if (payload.rataRataPenghasilan != null && payload.rataRataPenghasilan < 0) {
      setFormError('Rata-rata Penghasilan tidak boleh bernilai negatif.')
      setSubmitting(false)
      return
    }
    if (
      payload.jumlahPenduduk != null &&
      payload.usiaProduktif != null &&
      payload.usiaProduktif > payload.jumlahPenduduk
    ) {
      setFormError('Usia Produktif tidak boleh melebihi Jumlah Penduduk.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch(`/api/demografi/${activeDesaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        toast.success('Data demografi berhasil diperbarui')
        setEditModalOpen(false)
        if (isSuperAdmin) {
          fetchAdminData(searchQuery, page, selectedKecamatanIds)
        } else {
          fetchPemdesData()
        }
      } else {
        setFormError(res.message)
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  // --- LOAD AND SHOW DETAIL (Super Admin) ---
  const showDetailCard = async (desaId: string) => {
    setDetailLoading(true)
    setDetailData(null)
    setDetailModalOpen(true)
    try {
      const res = await fetch(`/api/demografi/${desaId}`).then(r => r.json())
      if (res.success) {
        setDetailData(res.data)
      } else {
        toast.error('Gagal memuat detail data demografi')
        setDetailModalOpen(false)
      }
    } catch {
      toast.error('Kesalahan koneksi')
      setDetailModalOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // --- FILTER HELPERS ---
  const toggleKecamatanSelection = (id: string) => {
    const updated = selectedKecamatanIds.includes(id)
      ? selectedKecamatanIds.filter(x => x !== id)
      : [...selectedKecamatanIds, id]
    setSelectedKecamatanIds(updated)
    setPage(1)
  }

  const selectAllKec = () => {
    setSelectedKecamatanIds(allKecamatans.map(k => k.id))
    setPage(1)
  }

  const resetKec = () => {
    setSelectedKecamatanIds([])
    setPage(1)
  }

  const formatRupiah = (val: number | null) => {
    if (val == null) return '-'
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)
  }

  const formatNumber = (val: number | null) => {
    if (val == null) return '-'
    return new Intl.NumberFormat('id-ID').format(val)
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-hairline border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Demografi Desa</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuperAdmin
            ? 'Lihat dan kelola profil demografi serta sarana prasarana desa di Kabupaten Muara Enim.'
            : 'Kelola informasi demografi, sarana prasarana, serta koordinat lokasi desa Anda.'}
        </p>
      </div>

      {!isSuperAdmin ? (
        // ==========================================
        // ─── ROLE: PEMDES (VILLAGE DETAIL VIEW) ───
        // ==========================================
        pemdesLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
          </div>
        ) : pemdesData ? (
          <div className="space-y-6">
            {renderDetailView(pemdesData, () =>
              loadForEdit(
                pemdesData.desaKelurahanId,
                pemdesData.desaKelurahan.nama,
                pemdesData.desaKelurahan.kecamatan.nama
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Building2 size={48} className="mb-4 opacity-40" />
            <p className="text-sm font-medium">Gagal memuat profil desa Anda</p>
            <Button size="sm" className="mt-4" onClick={fetchPemdesData}>Coba Lagi</Button>
          </div>
        )
      ) : (
        // ==========================================
        // ─── ROLE: SUPER ADMIN (LIST & SEARCH VIEW) ───
        // ==========================================
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau kode desa..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Filter Kecamatan */}
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="h-9 w-full md:w-auto flex justify-between items-center gap-2 text-xs md:text-sm font-medium"
              >
                <div className="flex items-center gap-1.5 text-left truncate max-w-[200px]">
                  <span className="text-muted-foreground">Kecamatan:</span>
                  <span>
                    {selectedKecamatanIds.length === 0
                      ? 'Semua'
                      : selectedKecamatanIds.length === allKecamatans.length
                        ? 'Semua'
                        : `${selectedKecamatanIds.length} Terpilih`}
                  </span>
                </div>
                <ChevronDown size={14} className="text-muted-foreground" />
              </Button>

              {dropdownOpen && (
                <div className="absolute left-0 mt-1 z-50 w-64 rounded-xl border border-hairline bg-[var(--color-surface)] shadow-elevated p-2 space-y-2 animate-in scale-in duration-200">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cari kecamatan..."
                      value={filterKecSearch}
                      onChange={(e) => setFilterKecSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-[var(--color-canvas-soft)]"
                    />
                  </div>

                  <div className="flex justify-between items-center px-1 text-[10px] text-muted-foreground">
                    <button onClick={selectAllKec} className="hover:text-primary transition-colors">Pilih Semua</button>
                    <button onClick={resetKec} className="hover:text-primary transition-colors">Reset</button>
                  </div>

                  <hr className="border-hairline" />

                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allKecamatans
                      .filter(k => k.nama.toLowerCase().includes(filterKecSearch.toLowerCase()))
                      .map((k) => {
                        const isSelected = selectedKecamatanIds.includes(k.id)
                        return (
                          <button
                            key={k.id}
                            onClick={() => toggleKecamatanSelection(k.id)}
                            className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-[var(--color-canvas-soft)] text-left"
                          >
                            <span className="truncate pr-2">{k.nama}</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-hairline'}`}>
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </div>
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Badges */}
            {selectedKecamatanIds.length > 0 && selectedKecamatanIds.length < allKecamatans.length && (
              <div className="flex flex-wrap items-center gap-1 max-h-9 overflow-y-auto max-w-md">
                {allKecamatans
                  .filter(k => selectedKecamatanIds.includes(k.id))
                  .map(k => (
                    <span key={k.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary font-mono text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {k.nama}
                      <button onClick={() => toggleKecamatanSelection(k.id)} className="hover:text-primary-active">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
              </div>
            )}

            <div className="ml-auto text-xs text-muted-foreground">
              {totalDesa} desa/kelurahan
            </div>
          </div>

          {/* Table */}
          <div className="border border-hairline rounded-xl overflow-hidden bg-[var(--color-surface)]">
            {adminLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
              </div>
            ) : desaList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Building2 size={36} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">Desa tidak ditemukan</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-[var(--color-canvas-soft)]">
                      <TableHead className="w-[56px] pl-4 text-xs font-semibold uppercase">No</TableHead>
                      <TableHead className="text-xs font-semibold uppercase">Desa/Kelurahan</TableHead>
                      <TableHead className="w-[140px] text-xs font-semibold uppercase">Kecamatan</TableHead>
                      <TableHead className="w-[120px] text-xs font-semibold uppercase text-right">Penduduk</TableHead>
                      <TableHead className="w-[110px] text-xs font-semibold uppercase text-right">Kepadatan (jiwa/km²)</TableHead>
                      <TableHead className="w-[160px] text-xs font-semibold uppercase text-right">Penghasilan</TableHead>
                      <TableHead className="w-[180px] text-xs font-semibold uppercase">Koordinat</TableHead>
                      <TableHead className="w-[140px] text-right pr-4 text-xs font-semibold uppercase">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {desaList.map((item, index) => {
                      const rowNum = (page - 1) * 10 + index + 1
                      return (
                        <TableRow key={item.id} className="transition-colors hover:bg-[var(--color-canvas-soft)]/50">
                          <TableCell className="text-muted-foreground font-mono text-sm pl-4">{rowNum}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground text-sm flex items-center gap-1.5">
                                {item.nama}
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none ${item.tipe === 'KELURAHAN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {item.tipe}
                                </span>
                              </div>
                              {item.kodeDesa && <span className="font-mono text-[10px] text-muted-foreground">Kode: {item.kodeDesa}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{item.kecamatan.nama}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatNumber(item.demografi?.jumlahPenduduk ?? null)}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatNumber(item.demografi?.kepadatan ?? null)}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatRupiah(item.demografi?.rataRataPenghasilan ?? null)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.latitude != null && item.longitude != null ? (
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-muted-foreground" />
                                {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="pr-4">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => showDetailCard(item.id)}
                              >
                                <FileText size={13} />
                                Detail
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Edit Demografi"
                                onClick={() => loadForEdit(item.id, item.nama, item.kecamatan.nama)}
                              >
                                <Pencil size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Menampilkan {(page - 1) * 10 + 1}–{Math.min(page * 10, totalDesa)} dari {totalDesa}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('dots')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) => p === 'dots' ? (
                    <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          ─── DETAILS MODAL (FOR SUPER ADMIN) ───
          ========================================== */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <span>Detail Profil</span>
              {detailData && (
                <span className="text-base font-normal text-muted-foreground">
                  — {detailData.desaKelurahan.nama} ({detailData.desaKelurahan.tipe})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Detail metrik demografi dan sarana prasarana desa.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              {renderDetailView(detailData, null)}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">Gagal memuat data detail.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ==========================================
          ─── SHARED EDIT MODAL (ADMIN & PEMDES) ───
          ========================================== */}
      <Dialog open={editModalOpen} onOpenChange={(open) => !open && setEditModalOpen(false)}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Demografi Desa</DialogTitle>
            <DialogDescription>
              Perbarui profil demografi, sarana prasarana, serta koordinat lokasi untuk <strong>{activeDesaNama}</strong>, Kecamatan {activeDesaKecamatan}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {/* Coordinates Section */}
              <div className="col-span-2 border border-hairline bg-[var(--color-canvas-soft)]/50 p-3 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin size={13} className="text-primary" />
                    Koordinat Lokasi Desa (Pusat Desa)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMapPickerModal(prev => !prev)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Map size={12} />
                    {showMapPickerModal ? 'Tutup Peta' : 'Pilih dari Peta'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-lat">Latitude (Garis Lintang)</Label>
                    <input
                      id="edit-lat"
                      type="number"
                      step="any"
                      placeholder="Contoh: -3.6540"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-lng">Longitude (Garis Bujur)</Label>
                    <input
                      id="edit-lng"
                      type="number"
                      step="any"
                      placeholder="Contoh: 103.8750"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                </div>
                {showMapPickerModal && (
                  <MapCoordinatePicker
                    latitude={latitude ? parseFloat(latitude) : null}
                    longitude={longitude ? parseFloat(longitude) : null}
                    onChange={(lat, lng) => {
                      setLatitude(String(lat))
                      setLongitude(String(lng))
                    }}
                    selectedDesaNama={activeDesaNama}
                    userRole={isSuperAdmin ? 'SUPER_ADMIN' : 'PEMDES'}
                  />
                )}
                <p className="text-[10px] text-muted-foreground">
                  Gunakan titik kantor desa atau pusat keramaian sebagai acuan perhitungan jarak sinyal.
                </p>
              </div>

              {/* Basic Metrics */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-penduduk">Jumlah Penduduk (Jiwa)</Label>
                <Input
                  id="edit-penduduk"
                  type="number"
                  min="0"
                  placeholder="Contoh: 3500"
                  value={jumlahPenduduk}
                  onChange={(e) => setJumlahPenduduk(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Total jiwa yang berdomisili di desa.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-produktif">Usia Produktif (Jiwa)</Label>
                <Input
                  id="edit-produktif"
                  type="number"
                  min="0"
                  placeholder="Contoh: 2100"
                  value={usiaProduktif}
                  onChange={(e) => setUsiaProduktif(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Jumlah penduduk usia kerja 15–64 tahun. Tidak boleh melebihi jumlah penduduk.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-kepadatan">Kepadatan Penduduk (Jiwa/km²)</Label>
                <Input
                  id="edit-kepadatan"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Contoh: 145.5"
                  value={kepadatan}
                  onChange={(e) => setKepadatan(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Rerata kepadatan penduduk per kilometer persegi.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-penghasilan">Rata-rata Penghasilan (Rp/Bulan)</Label>
                <Input
                  id="edit-penghasilan"
                  type="number"
                  min="0"
                  placeholder="Contoh: 2500000"
                  value={rataRataPenghasilan}
                  onChange={(e) => setRataRataPenghasilan(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Rerata penghasilan per kepala keluarga per bulan dalam Rupiah.</p>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-pencaharian">Mata Pencaharian Utama</Label>
                <Input
                  id="edit-pencaharian"
                  placeholder="Contoh: Petani Karet, Pekebun Sawit"
                  value={mataPencaharianUtama}
                  onChange={(e) => setMataPencaharianUtama(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Pekerjaan mayoritas penduduk desa.</p>
              </div>

              {/* Facilities / Infrastructure Checkboxes */}
              <div className="col-span-2 space-y-1.5">
                <Label>Sarana / Fasilitas Tersedia</Label>
                <div className="flex flex-wrap gap-4 py-2 items-center bg-[var(--color-canvas-soft)]/30 border border-hairline px-3 rounded-lg">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saranaKesehatan}
                      onChange={(e) => setSaranaKesehatan(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded border-hairline"
                    />
                    Sarana Kesehatan (Puskesmas/Pustu)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saranaPendidikan}
                      onChange={(e) => setSaranaPendidikan(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded border-hairline"
                    />
                    Sarana Pendidikan (SD/SMP/SMA)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pasar}
                      onChange={(e) => setPasar(e.target.checked)}
                      className="accent-primary w-4 h-4 rounded border-hairline"
                    />
                    Pasar Desa
                  </label>
                </div>
              </div>

              {/* Economic Activities */}
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-ekonomi">Kegiatan Ekonomi Utama</Label>
                <Input
                  id="edit-ekonomi"
                  placeholder="Keterangan singkat sentra/pusat ekonomi warga"
                  value={kegiatanEkonomi}
                  onChange={(e) => setKegiatanEkonomi(e.target.value)}
                />
              </div>

              {/* Catatan / Deskripsi tambahan */}
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-catatan">Catatan / Deskripsi Tambahan</Label>
                <textarea
                  id="edit-catatan"
                  placeholder="Catatan umum mengenai demografi desa..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-md border border-hairline bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                />
              </div>
            </div>
            {formError && <p className="text-xs text-destructive mt-2 font-medium">{formError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleEditSubmit} disabled={submitting}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Perbarui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  // --- COMPONENT: RENDER DETAIL VIEW (FOR BOTH ROLE PEMDES & MODAL DETAIL) ---
  function renderDetailView(data: DemografiData, onEditAction: (() => void) | null) {
    const desa = data.desaKelurahan

    return (
      <div className="space-y-6">
        {/* Village Summary Header Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-transparent border border-hairline rounded-2xl p-5 md:p-6 shadow-soft">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${desa.tipe === 'KELURAHAN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                {desa.tipe}
              </span>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{desa.nama}</h2>
              <p className="text-sm text-muted-foreground">
                Kecamatan {desa.kecamatan.nama} • Kode Desa/Kel: <span className="font-mono">{desa.kodeDesa || '-'}</span>
              </p>
            </div>

            {onEditAction && (
              <Button size="sm" onClick={onEditAction} className="h-9 px-4 shrink-0 shadow-soft">
                <Pencil size={15} className="mr-1.5" />
                Edit Data Demografi
              </Button>
            )}
          </div>

          {/* Coordinates Info */}
          <div className="mt-4 pt-4 border-t border-hairline flex flex-wrap gap-4 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-primary shrink-0" />
              <span>Pusat Koordinat:</span>
              <span className="text-foreground">
                {desa.latitude != null && desa.longitude != null
                  ? `${desa.latitude.toFixed(6)}, ${desa.longitude.toFixed(6)}`
                  : 'Belum diatur'}
              </span>
            </div>
            {data.updatedAt && (
              <div className="sm:ml-auto text-[10px] text-muted-foreground/80 self-center">
                Pembaruan Terakhir: {new Date(data.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        {/* Tikor Warning Banner */}
        {(desa.latitude == null || desa.longitude == null) && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <TriangleAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Koordinat pusat desa belum diisi
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Harap segera perbarui koordinat lokasi desa melalui tombol "Edit Data Demografi" untuk
                mengaktifkan perhitungan jarak sinyal dan deteksi tower terdekat.
              </p>
            </div>
          </div>
        )}

        {/* Peta Desa */}
        <DesaDetailMap
          desaId={desa.id}
          desaNama={desa.nama}
          latitude={desa.latitude}
          longitude={desa.longitude}
        />

        {/* Metrik Utama Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Jumlah Penduduk */}
          <Card className="shadow-soft hover:shadow-md transition-shadow border-hairline">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Jumlah Penduduk</CardTitle>
              <Users className="h-4 w-4 text-primary opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{formatNumber(data.jumlahPenduduk)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Total jiwa terdaftar di desa</p>
            </CardContent>
          </Card>

          {/* Card 2: Usia Produktif */}
          <Card className="shadow-soft hover:shadow-md transition-shadow border-hairline">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Usia Produktif</CardTitle>
              <Briefcase className="h-4 w-4 text-accent-teal opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{formatNumber(data.usiaProduktif)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {data.jumlahPenduduk && data.usiaProduktif
                  ? `${((data.usiaProduktif / data.jumlahPenduduk) * 100).toFixed(1)}% dari total penduduk (15-64 th)`
                  : 'Kelompok usia kerja'}
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Kepadatan Penduduk */}
          <Card className="shadow-soft hover:shadow-md transition-shadow border-hairline">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kepadatan Penduduk</CardTitle>
              <Building2 className="h-4 w-4 text-accent-orange opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">
                {data.kepadatan != null ? `${formatNumber(data.kepadatan)}` : '-'}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Rata-rata jiwa per kilometer persegi</p>
            </CardContent>
          </Card>

          {/* Card 4: Rata-rata Pendapatan */}
          <Card className="shadow-soft hover:shadow-md transition-shadow border-hairline">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rata-rata Pendapatan</CardTitle>
              <Coins className="h-4 w-4 text-accent-green opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-mono text-foreground leading-8 truncate">{formatRupiah(data.rataRataPenghasilan)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Rerata penghasilan per kepala keluarga</p>
            </CardContent>
          </Card>
        </div>

        {/* Infrastruktur & Detail Tambahan Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card: Sarana Prasarana */}
          <Card className="md:col-span-1 shadow-soft border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-foreground">Infrastruktur & Sarana Desa</CardTitle>
              <CardDescription>Fasilitas umum penunjang kebutuhan masyarakat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sarana Kesehatan */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-hairline bg-[var(--color-canvas-soft)]/20">
                <div className="flex items-center gap-2">
                  <HeartPulse className="text-destructive w-5 h-5" />
                  <span className="text-xs font-medium">Sarana Kesehatan</span>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${data.saranaKesehatan ? 'bg-success-light text-success' : 'bg-red-50 text-red-600'}`}>
                  {data.saranaKesehatan ? 'Tersedia' : 'Tidak Ada'}
                </span>
              </div>

              {/* Sarana Pendidikan */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-hairline bg-[var(--color-canvas-soft)]/20">
                <div className="flex items-center gap-2">
                  <GraduationCap className="text-primary w-5 h-5" />
                  <span className="text-xs font-medium">Sarana Pendidikan</span>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${data.saranaPendidikan ? 'bg-success-light text-success' : 'bg-red-50 text-red-600'}`}>
                  {data.saranaPendidikan ? 'Tersedia' : 'Tidak Ada'}
                </span>
              </div>

              {/* Pasar Desa */}
              <div className="flex items-center justify-between p-2 rounded-lg border border-hairline bg-[var(--color-canvas-soft)]/20">
                <div className="flex items-center gap-2">
                  <Store className="text-accent-orange w-5 h-5" />
                  <span className="text-xs font-medium">Pasar Desa</span>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${data.pasar ? 'bg-success-light text-success' : 'bg-red-50 text-red-600'}`}>
                  {data.pasar ? 'Tersedia' : 'Tidak Ada'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card: Aktivitas Ekonomi & Catatan */}
          <Card className="md:col-span-2 shadow-soft border-hairline">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-foreground">Profil Sosial & Ekonomi</CardTitle>
              <CardDescription>Gambaran mata pencaharian dan kegiatan ekonomi di desa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-hairline">
                <span className="text-muted-foreground font-medium">Mata Pencaharian Utama</span>
                <span className="col-span-2 text-foreground font-semibold">{data.mataPencaharianUtama || 'Belum diisi'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-b border-hairline">
                <span className="text-muted-foreground font-medium">Sentra Kegiatan Ekonomi</span>
                <span className="col-span-2 text-foreground">{data.kegiatanEkonomi || 'Belum diisi'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2">
                <span className="text-muted-foreground font-medium text-xs">Catatan Demografi</span>
                <span className="col-span-2 text-muted-foreground italic leading-relaxed text-xs">{data.catatan || 'Tidak ada catatan tambahan.'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
}
