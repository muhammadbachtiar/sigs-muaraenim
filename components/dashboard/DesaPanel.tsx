'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Package, AlertCircle, Search, ChevronLeft, ChevronRight, ChevronDown, Check, X, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { type ActionResult } from '@/lib/actions/master'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type DesaItem = {
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
}

type KecamatanItem = {
  id: string
  nama: string
  kode: string
}

interface PaginationMeta {
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface DesaPanelProps {
  title: string
  items: DesaItem[]
  loading: boolean
  meta: PaginationMeta | null
  searchValue: string
  onSearchChange: (val: string) => void
  onPageChange: (page: number) => void
  onAdd: (payload: any) => Promise<ActionResult>
  onEdit: (id: string, payload: any) => Promise<ActionResult>
  onDelete: (id: string) => Promise<ActionResult>
  selectedKecamatanIds: string[]
  onSelectedKecamatanIdsChange: (ids: string[]) => void
}

export default function DesaPanel({
  title, items, loading, meta, searchValue, onSearchChange, onPageChange, onAdd, onEdit, onDelete,
  selectedKecamatanIds, onSelectedKecamatanIdsChange,
}: DesaPanelProps) {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<DesaItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<DesaItem | null>(null)

  // Form states
  const [namaValue, setNamaValue] = useState('')
  const [kecamatanIdValue, setKecamatanIdValue] = useState<string | ''>('')
  const [tipeValue, setTipeValue] = useState<'DESA' | 'KELURAHAN'>('DESA')
  const [kodeDesaValue, setKodeDesaValue] = useState('')
  const [latValue, setLatValue] = useState('')
  const [lngValue, setLngValue] = useState('')
  
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dropdown states for multi-select Kecamatan filter
  const [allKecamatans, setAllKecamatans] = useState<KecamatanItem[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filterKecamatanSearch, setFilterKecamatanSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all kecamatan for selectors/filters
  useEffect(() => {
    async function loadKecamatans() {
      try {
        const res = await fetch('/api/master/kecamatan?page_size=100').then(r => r.json())
        if (res.success) {
          setAllKecamatans(res.data)
        }
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

  const handleAdd = async () => {
    if (!namaValue.trim()) return setFormError('Nama desa/kelurahan wajib diisi')
    if (!kecamatanIdValue) return setFormError('Kecamatan wajib dipilih')
    
    setFormError('')
    setSubmitting(true)

    const payload = {
      nama: namaValue.trim(),
      kecamatanId: kecamatanIdValue,
      tipe: tipeValue,
      kodeDesa: kodeDesaValue.trim() || null,
      latitude: latValue ? parseFloat(latValue) : null,
      longitude: lngValue ? parseFloat(lngValue) : null,
    }

    const result = await onAdd(payload)
    setSubmitting(false)
    if (result.success) {
      setShowAddModal(false)
      resetForm()
      toast.success(result.message)
    } else {
      setFormError(result.message)
    }
  }

  const handleEdit = async () => {
    if (!editItem) return
    if (!namaValue.trim()) return setFormError('Nama desa/kelurahan wajib diisi')
    if (!kecamatanIdValue) return setFormError('Kecamatan wajib dipilih')

    setFormError('')
    setSubmitting(true)

    const payload = {
      nama: namaValue.trim(),
      kecamatanId: kecamatanIdValue,
      tipe: tipeValue,
      kodeDesa: kodeDesaValue.trim() || null,
      latitude: latValue ? parseFloat(latValue) : null,
      longitude: lngValue ? parseFloat(lngValue) : null,
    }

    const result = await onEdit(editItem.id, payload)
    setSubmitting(false)
    if (result.success) {
      setEditItem(null)
      resetForm()
      toast.success(result.message)
    } else {
      setFormError(result.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    setSubmitting(true)
    const result = await onDelete(deleteItem.id)
    setSubmitting(false)
    if (result.success) {
      setDeleteItem(null)
      toast.success(result.message)
    } else {
      setDeleteItem(null)
      toast.error(result.message)
    }
  }

  const resetForm = () => {
    setNamaValue('')
    setKecamatanIdValue('')
    setTipeValue('DESA')
    setKodeDesaValue('')
    setLatValue('')
    setLngValue('')
    setFormError('')
  }

  const toggleKecamatanSelection = (id: string) => {
    if (selectedKecamatanIds.includes(id)) {
      onSelectedKecamatanIdsChange(selectedKecamatanIds.filter(x => x !== id))
    } else {
      onSelectedKecamatanIdsChange([...selectedKecamatanIds, id])
    }
  }

  const selectAllKecamatans = () => {
    onSelectedKecamatanIdsChange(allKecamatans.map(k => k.id))
  }

  const clearKecamatanSelection = () => {
    onSelectedKecamatanIdsChange([])
  }

  const filteredKecamatansForFilter = allKecamatans.filter(k =>
    k.nama.toLowerCase().includes(filterKecamatanSearch.toLowerCase())
  )

  const currentPage = meta?.page ?? 1
  const totalPages = meta?.total_pages ?? 1
  const total = meta?.total ?? items.length
  const pageSize = meta?.page_size ?? 10

  const rowOffset = (currentPage - 1) * pageSize

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toolbar: search + multi-select + add button */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Cari nama atau kode desa...`}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Multi-select Kecamatan Dropdown */}
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
                  value={filterKecamatanSearch}
                  onChange={(e) => setFilterKecamatanSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-[var(--color-canvas-soft)]"
                />
              </div>

              {/* Quick Actions */}
              <div className="flex justify-between items-center px-1 text-[10px] text-muted-foreground">
                <button onClick={selectAllKecamatans} className="hover:text-primary transition-colors">
                  Pilih Semua
                </button>
                <button onClick={clearKecamatanSelection} className="hover:text-primary transition-colors">
                  Reset
                </button>
              </div>

              <hr className="border-hairline" />

              {/* List */}
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredKecamatansForFilter.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-4">Kecamatan tidak ditemukan</div>
                ) : (
                  filteredKecamatansForFilter.map((k) => {
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
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected Badges (Tags) */}
        {selectedKecamatanIds.length > 0 && selectedKecamatanIds.length < allKecamatans.length && (
          <div className="flex flex-wrap items-center gap-1 max-h-9 overflow-y-auto max-w-md">
            {selectedKecamatansForTags().map(k => (
              <span key={k.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary font-mono text-[10px] font-medium px-2 py-0.5 rounded-full">
                {k.nama}
                <button onClick={() => toggleKecamatanSelection(k.id)} className="hover:text-primary-active">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 justify-between md:justify-end">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{total} data</span>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowAddModal(true) }}
            className="h-9 px-4"
          >
            <Plus size={16} className="mr-1.5" />
            Tambah {title}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-hairline rounded-xl overflow-hidden bg-[var(--color-surface)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-hairline border-t-primary rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Package size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Belum ada data</p>
            <p className="text-xs mt-1">Klik "Tambah" untuk menambahkan data baru</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-[var(--color-canvas-soft)]">
                  <TableHead className="w-[56px] text-xs tracking-wider uppercase font-semibold pl-4">No</TableHead>
                  <TableHead className="w-[140px] text-xs tracking-wider uppercase font-semibold">Kode Desa/Kel</TableHead>
                  <TableHead className="text-xs tracking-wider uppercase font-semibold">Nama Desa/Kelurahan</TableHead>
                  <TableHead className="w-[110px] text-xs tracking-wider uppercase font-semibold">Tipe</TableHead>
                  <TableHead className="w-[160px] text-xs tracking-wider uppercase font-semibold">Kecamatan</TableHead>
                  <TableHead className="w-[180px] text-xs tracking-wider uppercase font-semibold">Koordinat (Lat, Lng)</TableHead>
                  <TableHead className="w-[100px] text-right text-xs tracking-wider uppercase font-semibold pr-4">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id} className="transition-colors hover:bg-[var(--color-canvas-soft)]/50">
                    <TableCell className="text-muted-foreground font-mono text-sm pl-4">{rowOffset + index + 1}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.kodeDesa || '-'}</TableCell>
                    <TableCell className="font-medium text-foreground text-sm">{item.nama}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none ${item.tipe === 'KELURAHAN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                        {item.tipe}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{item.kecamatan?.nama || '-'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {item.latitude != null && item.longitude != null ? (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-muted-foreground" />
                          {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit"
                          onClick={() => {
                            setEditItem(item)
                            setNamaValue(item.nama)
                            setKecamatanIdValue(item.kecamatanId)
                            setTipeValue(item.tipe)
                            setKodeDesaValue(item.kodeDesa || '')
                            setLatValue(item.latitude != null ? String(item.latitude) : '')
                            setLngValue(item.longitude != null ? String(item.longitude) : '')
                            setFormError('')
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Hapus"
                          onClick={() => setDeleteItem(item)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Menampilkan {rowOffset + 1}–{Math.min(rowOffset + pageSize, total)} dari {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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
                  variant={p === currentPage ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambah {title}</DialogTitle>
            <DialogDescription>Masukkan data baru untuk {title.toLowerCase()}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm max-h-[70vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-kec">Kecamatan <span className="text-destructive">*</span></Label>
                <select
                  id="add-kec"
                  value={kecamatanIdValue}
                  onChange={(e) => setKecamatanIdValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {allKecamatans.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="add-nama">Nama Desa/Kelurahan <span className="text-destructive">*</span></Label>
                <Input
                  id="add-nama"
                  placeholder="Nama desa/kelurahan"
                  value={namaValue}
                  onChange={(e) => setNamaValue(e.target.value)}
                  className={formError && !namaValue.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipe Desa/Kelurahan <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 h-9 items-center">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="tipe"
                      value="DESA"
                      checked={tipeValue === 'DESA'}
                      onChange={() => setTipeValue('DESA')}
                      className="accent-primary"
                    />
                    DESA
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="tipe"
                      value="KELURAHAN"
                      checked={tipeValue === 'KELURAHAN'}
                      onChange={() => setTipeValue('KELURAHAN')}
                      className="accent-primary"
                    />
                    KELURAHAN
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-kode">Kode Desa/Kelurahan</Label>
                <Input
                  id="add-kode"
                  placeholder="Kode (opsional)"
                  value={kodeDesaValue}
                  onChange={(e) => setKodeDesaValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-lat">Latitude (Garis Lintang)</Label>
                <Input
                  id="add-lat"
                  type="number"
                  step="any"
                  placeholder="Contoh: -3.6540"
                  value={latValue}
                  onChange={(e) => setLatValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-lng">Longitude (Garis Bujur)</Label>
                <Input
                  id="add-lng"
                  type="number"
                  step="any"
                  placeholder="Contoh: 103.8750"
                  value={lngValue}
                  onChange={(e) => setLngValue(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="text-xs text-destructive mt-2 font-medium">{formError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={submitting || !namaValue.trim() || !kecamatanIdValue}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
            <DialogDescription>Ubah data untuk {title.toLowerCase()} ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm max-h-[70vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-kec">Kecamatan <span className="text-destructive">*</span></Label>
                <select
                  id="edit-kec"
                  value={kecamatanIdValue}
                  onChange={(e) => setKecamatanIdValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {allKecamatans.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-nama">Nama Desa/Kelurahan <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-nama"
                  placeholder="Nama desa/kelurahan"
                  value={namaValue}
                  onChange={(e) => setNamaValue(e.target.value)}
                  className={formError && !namaValue.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipe Desa/Kelurahan <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 h-9 items-center">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="edit-tipe"
                      value="DESA"
                      checked={tipeValue === 'DESA'}
                      onChange={() => setTipeValue('DESA')}
                      className="accent-primary"
                    />
                    DESA
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="edit-tipe"
                      value="KELURAHAN"
                      checked={tipeValue === 'KELURAHAN'}
                      onChange={() => setTipeValue('KELURAHAN')}
                      className="accent-primary"
                    />
                    KELURAHAN
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-kode">Kode Desa/Kelurahan</Label>
                <Input
                  id="edit-kode"
                  placeholder="Kode (opsional)"
                  value={kodeDesaValue}
                  onChange={(e) => setKodeDesaValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-lat">Latitude (Garis Lintang)</Label>
                <Input
                  id="edit-lat"
                  type="number"
                  step="any"
                  placeholder="Contoh: -3.6540"
                  value={latValue}
                  onChange={(e) => setLatValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-lng">Longitude (Garis Bujur)</Label>
                <Input
                  id="edit-lng"
                  type="number"
                  step="any"
                  placeholder="Contoh: 103.8750"
                  value={lngValue}
                  onChange={(e) => setLngValue(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="text-xs text-destructive mt-2 font-medium">{formError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Batal</Button>
            <Button onClick={handleEdit} disabled={submitting || !namaValue.trim() || !kecamatanIdValue}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Perbarui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader className="items-center sm:text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle size={24} className="text-destructive" />
            </div>
            <DialogTitle>Konfirmasi Hapus</DialogTitle>
            <DialogDescription className="text-center">
              Apakah Anda yakin ingin menghapus <strong>{deleteItem?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={submitting}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting && <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  function selectedKecamatansForTags() {
    return allKecamatans.filter(k => selectedKecamatanIds.includes(k.id))
  }
}
