'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  TowerControl, Plus, Search, MapPin, Pencil, CheckCircle2, AlertCircle,
  XCircle, Clock, Eye, Trash2, Camera, Upload, Loader2, RefreshCw,
  ShieldCheck, ArrowUpRight, FileText, Check, X, Building, Radio, Wifi, Network,
  ImageIcon, Sparkles, AlertTriangle, LayoutGrid, List, Map
} from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

const TowerMap = dynamic(() => import('@/components/map/TowerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] rounded-xl border border-hairline bg-[var(--color-surface)] flex items-center justify-center text-xs text-muted-foreground">
      <Loader2 size={18} className="animate-spin mr-2" /> Memuat Peta Tower...
    </div>
  ),
})

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// --- CONSTANTS ---

const TOWER_HEIGHT_OPTIONS = [
  { value: 'Rooftop / Microcell (< 15m)', label: 'Rooftop Pole / Microcell (< 15m)' },
  { value: 'Under 20m (< 20 Meter)', label: 'Under 20m (< 20 Meter)' },
  { value: '20m - 30m (Monopole Standar)', label: '20m - 30m (Monopole Standar)' },
  { value: '32m - 42m (SST 3/4 Kaki)', label: '32m - 42m (SST 3/4 Kaki)' },
  { value: '45m - 52m (SST Tinggi)', label: '45m - 52m (SST Tinggi)' },
  { value: '60m - 72m (Macro Cell)', label: '60m - 72m (Macro Cell / Heavy Duty)' },
  { value: 'Lebih dari 72m (> 72 Meter)', label: 'Lebih dari 72m (> 72 Meter)' },
]

const MAX_AUTO_COMPRESS_SIZE = 3 * 1024 * 1024 // 3MB

// --- TYPES ---

type StatusVerifikasi = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DRAFT'

type TowerItem = {
  id: string
  namaTower: string
  deskripsiLokasi: string | null
  latitude: number
  longitude: number
  tinggiKategori: string | null
  statusVerifikasi: StatusVerifikasi
  alasanPenolakan: string | null
  createdAt: string
  updatedAt: string
  kecamatan: { id: string; nama: string }
  desaKelurahan: { id: string; nama: string } | null
  user: { id: string; nama: string; role: 'SUPER_ADMIN' | 'PEMDES' }
  towerOperator: Array<{ operator: { id: string; nama: string } }>
  towerTeknologi: Array<{ teknologi: { id: string; nama: string } }>
  towerMedia: Array<{ mediaTransmisi: { id: string; nama: string } }>
  _count?: { foto: number }
  foto?: Array<{ id: string; url: string; keterangan: string | null; createdAt: string }>
}

type SelectOption = {
  id: string
  nama: string
}

type DesaOption = {
  id: string
  nama: string
  kecamatanId: string
}

type TowerMapForDuplicate = { id: string; namaTower: string; latitude: number; longitude: number }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function TowerPage() {
  const { data: session, status } = useSession()
  const user = session?.user as any
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // --- MAIN STATES ---
  const [towers, setTowers] = useState<TowerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map'>('grid')

  // Meta stats
  const [totalAll, setTotalAll] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [totalApproved, setTotalApproved] = useState(0)
  const [totalRejected, setTotalRejected] = useState(0)

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatusVerifikasi>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterKecId, setFilterKecId] = useState('')
  const [filterDesaId, setFilterDesaId] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Master options
  const [allKecamatans, setAllKecamatans] = useState<SelectOption[]>([])
  const [allDesas, setAllDesas] = useState<DesaOption[]>([])
  const [filterDesas, setFilterDesas] = useState<DesaOption[]>([])
  const [formDesas, setFormDesas] = useState<DesaOption[]>([])
  const [allOperators, setAllOperators] = useState<SelectOption[]>([])
  const [allTeknologi, setAllTeknologi] = useState<SelectOption[]>([])
  const [allMedia, setAllMedia] = useState<SelectOption[]>([])
  const [allTowersForDuplicate, setAllTowersForDuplicate] = useState<TowerMapForDuplicate[]>([])
  const [formDesasLoading, setFormDesasLoading] = useState(false)

  // --- MODAL CONTROLS ---
  const [showFormModal, setShowFormModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Target item for view/edit/verify/delete/upload
  const [activeTower, setActiveTower] = useState<TowerItem | null>(null)
  const [detailTower, setDetailTower] = useState<TowerItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // --- FORM FIELDS ---
  const [formNama, setFormNama] = useState('')
  const [formTinggi, setFormTinggi] = useState('')
  const [formKecId, setFormKecId] = useState('')
  const [formDesaId, setFormDesaId] = useState('')
  const [formLat, setFormLat] = useState('')
  const [formLng, setFormLng] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [selectedOpIds, setSelectedOpIds] = useState<string[]>([])
  const [selectedTekIds, setSelectedTekIds] = useState<string[]>([])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])

  // Multiple Photos in Form
  const [formPhotos, setFormPhotos] = useState<File[]>([])

  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Verification Form State (Super Admin)
  const [verifyStatus, setVerifyStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [verifyAlasan, setVerifyAlasan] = useState('')

  // Upload Foto Modal Form State (Multiple Upload)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formLatNum = formLat ? parseFloat(formLat) : null
  const formLngNum = formLng ? parseFloat(formLng) : null

  const nearbyDuplicate = useMemo(() => {
    if (formLatNum == null || formLngNum == null || isNaN(formLatNum) || isNaN(formLngNum)) return null
    const editingId = activeTower?.id
    for (const t of allTowersForDuplicate) {
      if (t.id === editingId) continue
      const dist = haversineKm(formLatNum, formLngNum, t.latitude, t.longitude)
      if (dist < 0.5) return { tower: t, distance: Math.round(dist * 1000) }
    }
    return null
  }, [formLatNum, formLngNum, allTowersForDuplicate, activeTower])

  const photoCountWarning = !activeTower && formPhotos.length < 2

  // --- FETCH MASTER DATA ON MOUNT ---
  useEffect(() => {
    if (status === 'authenticated') {
      // Fetch Kecamatan
      fetch('/api/master/kecamatan?is_select=true')
        .then(r => r.json())
        .then(res => { if (res.success) setAllKecamatans(res.data) })
        .catch(err => console.error(err))

      // Fetch Operator
      fetch('/api/master/operator?is_select=true')
        .then(r => r.json())
        .then(res => { if (res.success) setAllOperators(res.data) })
        .catch(err => console.error(err))

      // Fetch Teknologi
      fetch('/api/master/teknologi?is_select=true')
        .then(r => r.json())
        .then(res => { if (res.success) setAllTeknologi(res.data) })
        .catch(err => console.error(err))

      // Fetch Media Transmisi
      fetch('/api/master/media?is_select=true')
        .then(r => r.json())
        .then(res => { if (res.success) setAllMedia(res.data) })
        .catch(err => console.error(err))

      fetch('/api/tower?for_map=true')
        .then(r => r.json())
        .then(res => { if (res.success) setAllTowersForDuplicate(res.data) })
        .catch(err => console.error(err))
    }
  }, [status])

  // Fetch desas when filter kecamatan changes
  useEffect(() => {
    if (filterKecId) {
      fetch(`/api/master/desa?is_select=true&kecamatan_id=${filterKecId}`)
        .then(r => r.json())
        .then(res => { if (res.success) setFilterDesas(res.data) })
        .catch(err => console.error(err))
    } else {
      setFilterDesas([])
      setFilterDesaId('')
    }
  }, [filterKecId])

  // Helper: Fetch desas for form modal
  const fetchFormDesas = async (kecId: string) => {
    if (!kecId) {
      setFormDesas([])
      return
    }
    setFormDesasLoading(true)
    try {
      const res = await fetch(`/api/master/desa?is_select=true&kecamatan_id=${kecId}`).then(r => r.json())
      if (res.success) setFormDesas(res.data)
    } catch {
      toast.error('Gagal memuat daftar desa')
    } finally {
      setFormDesasLoading(false)
    }
  }

  // --- FETCH TOWERS LIST ---
  const fetchTowers = useCallback(async (
    query: string,
    pageNum: number,
    stat: typeof statusFilter,
    kecId: string,
    desaId: string
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        page_size: '10',
      })
      if (query) params.set('search', query)
      if (stat !== 'ALL') params.set('status_verifikasi', stat)
      if (kecId) params.set('kecamatan_id', kecId)
      if (desaId) params.set('desa_id', desaId)

      const res = await fetch(`/api/tower?${params}`).then(r => r.json())
      if (res.success) {
        setTowers(res.data)
        setTotalAll(res.meta.totalAll ?? res.meta.total)
        setTotalPending(res.meta.totalPending ?? 0)
        setTotalApproved(res.meta.totalApproved ?? 0)
        setTotalRejected(res.meta.totalRejected ?? 0)
        setTotalPages(res.meta.total_pages)
      } else {
        toast.error(res.message || 'Gagal memuat data tower')
      }
    } catch {
      toast.error('Kesalahan jaringan saat memuat tower')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTowers(searchQuery, page, statusFilter, filterKecId, filterDesaId)
    }
  }, [status, page, statusFilter, filterKecId, filterDesaId, fetchTowers])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetchTowers(val, 1, statusFilter, filterKecId, filterDesaId)
    }, 350)
  }

  // --- FORM RESET HELPER ---
  const resetForm = () => {
    setActiveTower(null)
    setFormNama('')
    setFormTinggi('')
    setFormKecId('')
    setFormDesaId('')
    setFormLat('')
    setFormLng('')
    setFormDeskripsi('')
    setSelectedOpIds([])
    setSelectedTekIds([])
    setSelectedMediaIds([])
    setFormPhotos([])
    setFormDesas([])
    setFormError('')
  }

  // --- OPEN MODAL HANDLERS ---
  const openAddModal = () => {
    resetForm()
    setShowFormModal(true)
  }

  const openEditModal = async (tower: TowerItem) => {
    setActiveTower(tower)
    setFormNama(tower.namaTower)
    setFormTinggi(tower.tinggiKategori || '')
    setFormKecId(tower.kecamatan?.id || '')
    setFormDesaId(tower.desaKelurahan?.id || '')
    setFormLat(String(tower.latitude))
    setFormLng(String(tower.longitude))
    setFormDeskripsi(tower.deskripsiLokasi || '')
    setSelectedOpIds(tower.towerOperator.map(o => o.operator.id))
    setSelectedTekIds(tower.towerTeknologi.map(t => t.teknologi.id))
    setSelectedMediaIds(tower.towerMedia.map(m => m.mediaTransmisi.id))
    setFormPhotos([])
    setFormError('')

    if (tower.kecamatan?.id) {
      await fetchFormDesas(tower.kecamatan.id)
    }
    setShowFormModal(true)
  }

  const openVerifyModal = (tower: TowerItem) => {
    setActiveTower(tower)
    setVerifyStatus('APPROVED')
    setVerifyAlasan('')
    setShowVerifyModal(true)
  }

  const openDetailModal = async (tower: TowerItem) => {
    setActiveTower(tower)
    setShowDetailModal(true)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/tower/${tower.id}`).then(r => r.json())
      if (res.success) {
        setDetailTower(res.data)
      } else {
        toast.error(res.message || 'Gagal mengambil detail tower')
      }
    } catch {
      toast.error('Kesalahan saat memuat detail tower')
    } finally {
      setDetailLoading(false)
    }
  }

  const openUploadModal = (tower: TowerItem) => {
    setActiveTower(tower)
    setUploadFiles([])
    setUploadCaption('')
    setShowUploadModal(true)
  }

  const openDeleteModal = (tower: TowerItem) => {
    setActiveTower(tower)
    setShowDeleteModal(true)
  }

  // File verification helper
  const handleSelectFiles = (files: FileList | null, setTarget: React.Dispatch<React.SetStateAction<File[]>>) => {
    if (!files) return
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const validFiles: File[] = []

    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        toast.error(`File "${file.name}" diabaikan karena format tidak didukung.`)
      } else {
        validFiles.push(file)
      }
    })

    setTarget(prev => [...prev, ...validFiles])
  }

  // --- SUBMIT HANDLERS ---
  const handleSaveTower = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNama.trim()) return setFormError('Nama tower wajib diisi')
    if (!formKecId) return setFormError('Kecamatan lokasi wajib dipilih')

    const latNum = parseFloat(formLat)
    const lngNum = parseFloat(formLng)
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return setFormError('Koordinat Latitude tidak valid (-90 s/d 90)')
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return setFormError('Koordinat Longitude tidak valid (-180 s/d 180)')
    }

    setFormError('')
    setSubmitting(true)

    const payload = {
      namaTower: formNama.trim(),
      tinggiKategori: formTinggi || null,
      kecamatanId: formKecId,
      desaKelurahanId: formDesaId || null,
      latitude: latNum,
      longitude: lngNum,
      deskripsiLokasi: formDeskripsi.trim() || null,
      operatorIds: selectedOpIds,
      teknologiIds: selectedTekIds,
      mediaIds: selectedMediaIds,
    }

    try {
      const url = activeTower ? `/api/tower/${activeTower.id}` : '/api/tower'
      const method = activeTower ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        const createdOrUpdatedId = activeTower ? activeTower.id : res.data?.id

        // Upload any attached photos if available
        if (formPhotos.length > 0 && createdOrUpdatedId) {
          const formData = new FormData()
          formData.append('tower_id', createdOrUpdatedId)
          formPhotos.forEach(file => formData.append('files', file))

          await fetch('/api/upload/tower', {
            method: 'POST',
            body: formData,
          })
        }

        toast.success(res.message || (activeTower ? 'Tower berhasil diperbarui' : 'Tower berhasil diajukan'))
        setShowFormModal(false)
        resetForm()
        fetchTowers(searchQuery, page, statusFilter, filterKecId, filterDesaId)
      } else {
        setFormError(res.message)
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTower) return
    if (verifyStatus === 'REJECTED' && !verifyAlasan.trim()) {
      return toast.error('Alasan penolakan wajib diisi!')
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/tower/${activeTower.id}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statusVerifikasi: verifyStatus,
          alasanPenolakan: verifyStatus === 'REJECTED' ? verifyAlasan.trim() : null,
        }),
      }).then(r => r.json())

      if (res.success) {
        toast.success(res.message || 'Status verifikasi tower berhasil diperbarui')
        setShowVerifyModal(false)
        setActiveTower(null)
        fetchTowers(searchQuery, page, statusFilter, filterKecId, filterDesaId)
      } else {
        toast.error(res.message || 'Gagal memverifikasi tower')
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUploadPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTower) return
    if (uploadFiles.length === 0) return toast.error('Silakan pilih minimal 1 foto terlebih dahulu')

    setUploading(true)
    const formData = new FormData()
    formData.append('tower_id', activeTower.id)
    if (uploadCaption.trim()) formData.append('keterangan', uploadCaption.trim())

    uploadFiles.forEach(file => {
      formData.append('files', file)
    })

    try {
      const res = await fetch('/api/upload/tower', {
        method: 'POST',
        body: formData,
      }).then(r => r.json())

      if (res.success) {
        toast.success(res.message || 'Foto tower berhasil diunggah')
        setShowUploadModal(false)
        setUploadFiles([])
        setUploadCaption('')

        // Refresh detail if detail modal is open
        if (showDetailModal) {
          openDetailModal(activeTower)
        }
        fetchTowers(searchQuery, page, statusFilter, filterKecId, filterDesaId)
      } else {
        toast.error(res.message || 'Gagal mengunggah foto')
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan saat mengunggah foto')
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = async (fotoId: string) => {
    try {
      const res = await fetch(`/api/foto/${fotoId}`, { method: 'DELETE' }).then(r => r.json())
      if (res.success) {
        toast.success('Foto berhasil dihapus')
        if (activeTower) openDetailModal(activeTower)
        fetchTowers(searchQuery, page, statusFilter, filterKecId, filterDesaId)
      } else {
        toast.error(res.message || 'Gagal menghapus foto')
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    }
  }

  const handleDeleteTowerSubmit = async () => {
    if (!activeTower) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tower/${activeTower.id}`, { method: 'DELETE' }).then(r => r.json())
      if (res.success) {
        toast.success('Tower berhasil dihapus')
        setShowDeleteModal(false)
        setActiveTower(null)
        fetchTowers(searchQuery, page, statusFilter, filterKecId, filterDesaId)
      } else {
        toast.error(res.message || 'Gagal menghapus tower')
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper Badge Status
  const renderStatusBadge = (stat: StatusVerifikasi) => {
    switch (stat) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
            <CheckCircle2 size={12} /> Disetujui
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={12} /> Pending Verifikasi
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            <XCircle size={12} /> Ditolak (Revisi)
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            {stat}
          </span>
        )
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <TowerControl className="text-primary" size={24} />
            Manajemen Tower Telepon & BTS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? 'Verifikasi, persetujuan, dan kelola sebaran infrastruktur tower telekomunikasi di Kabupaten Muara Enim.'
              : 'Ajukan pembangunan atau perbaikan tower di wilayah desa Anda serta pantau proses verifikasi.'}
          </p>
        </div>
        <Button onClick={openAddModal} className="h-9 shadow-soft">
          <Plus size={16} className="mr-1.5" />
          {isSuperAdmin ? 'Tambah Tower Baru' : 'Pengajuan Tower Baru'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-hairline shadow-soft bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Tower</p>
              <div className="text-3xl font-bold font-mono mt-1 text-foreground">{totalAll}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <TowerControl size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-soft bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Perlu Verifikasi</p>
              <div className="text-3xl font-bold font-mono mt-1 text-amber-600 dark:text-amber-400">
                {totalPending}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-soft bg-gradient-to-br from-success/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Disetujui</p>
              <div className="text-3xl font-bold font-mono mt-1 text-success">{totalApproved}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <CheckCircle2 size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-soft bg-gradient-to-br from-destructive/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ditolak (Revisi)</p>
              <div className="text-3xl font-bold font-mono mt-1 text-destructive">{totalRejected}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <XCircle size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Toolbar */}
      <div className="space-y-4">
        {/* Status Tabs */}
        <div className="flex border-b border-hairline overflow-x-auto gap-2">
          {[
            { key: 'ALL', label: 'Semua Tower', count: totalAll },
            { key: 'PENDING', label: 'Perlu Verifikasi', count: totalPending, badge: 'amber' },
            { key: 'APPROVED', label: 'Disetujui', count: totalApproved },
            { key: 'REJECTED', label: 'Ditolak', count: totalRejected },
          ].map((tab) => {
            const isActive = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key as any); setPage(1) }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-hairline'
                  }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : tab.badge === 'amber' && tab.count > 0
                      ? 'bg-amber-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Toolbar: Search, Select Filters & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama tower, deskripsi, atau pemohon..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Select Kecamatan */}
            <select
              value={filterKecId}
              onChange={(e) => { setFilterKecId(e.target.value); setPage(1) }}
              className="flex h-9 w-full sm:w-[170px] rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="">-- Semua Kecamatan --</option>
              {allKecamatans.map(k => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>

            {/* Select Desa */}
            <select
              disabled={!filterKecId}
              value={filterDesaId}
              onChange={(e) => { setFilterDesaId(e.target.value); setPage(1) }}
              className="flex h-9 w-full sm:w-[170px] rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
            >
              <option value="">-- Semua Desa --</option>
              {filterDesas.map(d => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>

            {(filterKecId || filterDesaId || searchQuery || statusFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterKecId('')
                  setFilterDesaId('')
                  setSearchQuery('')
                  setStatusFilter('ALL')
                  setPage(1)
                }}
                className="h-9 px-2 text-xs text-muted-foreground"
              >
                Reset Filter
              </Button>
            )}
          </div>

          {/* View Mode Toggle Switch (Grid vs Table vs Map) */}
          <div className="flex items-center border border-hairline rounded-lg p-0.5 bg-[var(--color-surface)] shadow-xs shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Tampilan Kartu (Notion Style)"
            >
              <LayoutGrid size={14} /> Kartu
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Tampilan Tabel Ringkas"
            >
              <List size={14} /> Tabel
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'map'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Tampilan Peta"
            >
              <Map size={14} /> Peta
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Grid View vs Table View vs Map View */}
      {viewMode === 'map' ? (
        <TowerMap
          filterKecId={filterKecId}
          filterDesaId={filterDesaId}
          onSelectDetail={(id) => {
            const found = towers.find(t => t.id === id)
            if (found) openDetailModal(found)
            else fetch(`/api/tower/${id}`).then(r => r.json()).then(res => { if (res.success) openDetailModal(res.data) })
          }}
        />
      ) : (
        <>
          {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : towers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border border-hairline rounded-xl bg-[var(--color-surface)]">
          <TowerControl size={40} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">Tidak ada data tower ditemukan</p>
          <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter yang diterapkan.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ==========================================================
           ─── VIEW MODE: CARD GRID (NOTION STYLE - EASY TO READ) ───
           ========================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {towers.map((item) => {
            const canEditOrDelete = isSuperAdmin || (user?.id && item.user?.id === user.id)

            return (
              <Card
                key={item.id}
                className="border-hairline shadow-soft hover:shadow-md transition-all bg-[var(--color-surface)] flex flex-col justify-between overflow-hidden"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top Bar: Status Badge & Photo indicator */}
                  <div className="flex items-center justify-between gap-2">
                    {renderStatusBadge(item.statusVerifikasi)}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono font-medium">
                      <Camera size={11} /> {item._count?.foto ?? 0} Foto
                    </span>
                  </div>

                  {/* Header: Nama Tower & Height Badge */}
                  <div>
                    <h3 className="font-bold text-base text-foreground tracking-tight leading-snug flex items-start justify-between gap-2">
                      <span>{item.namaTower}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-semibold font-mono">
                        {item.tinggiKategori || 'Ketinggian N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Location & Coordinates */}
                  <div className="space-y-1 text-xs border-t border-hairline pt-3">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <MapPin size={14} className="text-primary shrink-0" />
                      <span>
                        {item.desaKelurahan?.nama ? `${item.desaKelurahan.nama}, ` : ''}
                        Kec. {item.kecamatan?.nama}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono pl-5">
                      Lat: {item.latitude}, Lng: {item.longitude}
                    </div>
                    {item.deskripsiLokasi && (
                      <p className="text-[11px] text-muted-foreground italic pl-5 line-clamp-2 mt-0.5">
                        &quot;{item.deskripsiLokasi}&quot;
                      </p>
                    )}
                  </div>

                  {/* Badges: Operator, Tech, Media */}
                  <div className="space-y-2 border-t border-hairline pt-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Operator:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.towerOperator.map(op => (
                          <span key={op.operator.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {op.operator.nama}
                          </span>
                        ))}
                        {item.towerOperator.length === 0 && (
                          <span className="text-[10px] text-muted-foreground italic">Belum ada</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap gap-1">
                        {item.towerTeknologi.map(t => (
                          <span key={t.teknologi.id} className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                            {t.teknologi.nama}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.towerMedia.map(m => (
                          <span key={m.mediaTransmisi.id} className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">
                            {m.mediaTransmisi.nama}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Rejection Note Banner if REJECTED */}
                  {item.statusVerifikasi === 'REJECTED' && item.alasanPenolakan && (
                    <div className="p-2.5 border border-destructive/30 bg-destructive/10 rounded-lg text-xs space-y-0.5">
                      <span className="font-semibold text-destructive flex items-center gap-1 text-[11px]">
                        <XCircle size={12} /> Catatan Penolakan:
                      </span>
                      <p className="text-[11px] text-foreground italic line-clamp-2">
                        &quot;{item.alasanPenolakan}&quot;
                      </p>
                    </div>
                  )}

                  {/* Submitter Info Footer */}
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-hairline pt-3">
                    <span>Pengaju: <strong>{item.user?.nama}</strong></span>
                    <span className="font-mono">{new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-1.5 border-t border-hairline pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-1"
                      onClick={() => openDetailModal(item)}
                    >
                      <Eye size={13} className="mr-1" /> Detail
                    </Button>

                    {isSuperAdmin && item.statusVerifikasi === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50/50 hover:bg-amber-100 flex-1"
                        onClick={() => openVerifyModal(item)}
                      >
                        <ShieldCheck size={13} className="mr-1 text-amber-600" /> Verifikasi
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Upload Multiple Foto Site"
                      onClick={() => openUploadModal(item)}
                    >
                      <Upload size={14} />
                    </Button>

                    {canEditOrDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={item.statusVerifikasi === 'REJECTED' ? 'Edit & Ajukan Ulang' : 'Edit Data Tower'}
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil size={14} />
                      </Button>
                    )}

                    {canEditOrDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Hapus Tower"
                        onClick={() => openDeleteModal(item)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ==========================================================
           ─── VIEW MODE: COMPACT TABLE (STREAMLINED & CLEAN) ───
           ========================================================== */
        <div className="border border-hairline rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-soft">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-[var(--color-canvas-soft)]">
                  <TableHead className="w-[45px] pl-4 text-xs font-semibold uppercase">No</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Nama Tower & Tinggi</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Wilayah & Koordinat</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Operator & Sinyal</TableHead>
                  <TableHead className="w-[130px] text-xs font-semibold uppercase">Status</TableHead>
                  <TableHead className="w-[130px] text-xs font-semibold uppercase">Pemohon</TableHead>
                  <TableHead className="w-[150px] text-right pr-4 text-xs font-semibold uppercase">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {towers.map((item, index) => {
                  const rowNum = (page - 1) * 10 + index + 1
                  const canEditOrDelete = isSuperAdmin || (user?.id && item.user?.id === user.id)

                  return (
                    <TableRow key={item.id} className="transition-colors hover:bg-[var(--color-canvas-soft)]/50">
                      <TableCell className="text-muted-foreground font-mono text-xs pl-4">{rowNum}</TableCell>

                      {/* Nama & Tinggi */}
                      <TableCell className="text-sm">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {item.namaTower}
                          {(item._count?.foto ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-mono" title={`${item._count?.foto} foto terlampir`}>
                              <Camera size={10} /> {item._count?.foto}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {item.tinggiKategori || 'Tinggi N/A'}
                        </div>
                      </TableCell>

                      {/* Wilayah & Koordinat */}
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">
                          {item.desaKelurahan?.nama ? `${item.desaKelurahan.nama}, ` : ''}
                          Kec. {item.kecamatan?.nama}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {item.latitude}, {item.longitude}
                        </div>
                      </TableCell>

                      {/* Operator & Sinyal */}
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1 mb-0.5">
                          {item.towerOperator.map(op => (
                            <span key={op.operator.id} className="px-1.5 py-0.2 rounded text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              {op.operator.nama}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.towerTeknologi.map(t => (
                            <span key={t.teknologi.id} className="px-1 py-0.2 rounded text-[9px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {t.teknologi.nama}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {renderStatusBadge(item.statusVerifikasi)}
                      </TableCell>

                      {/* Pemohon */}
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">{item.user?.nama || '—'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-4">
                        <div className="flex gap-1 justify-end items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Lihat Detail & Foto"
                            onClick={() => openDetailModal(item)}
                          >
                            <Eye size={14} />
                          </Button>

                          {isSuperAdmin && item.statusVerifikasi === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50/50 hover:bg-amber-100"
                              onClick={() => openVerifyModal(item)}
                            >
                              <ShieldCheck size={13} />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Upload Foto"
                            onClick={() => openUploadModal(item)}
                          >
                            <Upload size={14} />
                          </Button>

                          {canEditOrDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditModal(item)}
                            >
                              <Pencil size={14} />
                            </Button>
                          )}

                          {canEditOrDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => openDeleteModal(item)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs">
          <p className="text-muted-foreground">
            Menampilkan {(page - 1) * 10 + 1}–{Math.min(page * 10, totalAll)} dari {totalAll} tower
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </Button>
            <span className="px-2 font-mono">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
        </>
      )}

      {/* ==========================================================
          ─── MODAL: FORM TAMBAH / EDIT TOWER (MULTIPLE PHOTO & STATIC SELECT) ───
          ========================================================== */}
      <Dialog open={showFormModal} onOpenChange={setShowFormModal}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TowerControl size={20} className="text-primary" />
              <span>{activeTower ? 'Edit Data Tower' : 'Form Pengajuan Tower Baru'}</span>
            </DialogTitle>
            <DialogDescription>
              Isi spesifikasi teknis, wilayah, serta koordinat lokasi pendirian tower telekomunikasi.
            </DialogDescription>
          </DialogHeader>

          {/* Rejection Alert Banner if editing REJECTED tower */}
          {activeTower && activeTower.statusVerifikasi === 'REJECTED' && (
            <div className="p-3 border border-destructive/30 bg-destructive/10 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-destructive flex items-center gap-1.5">
                <AlertCircle size={14} />
                Tower Sebelumnya Ditolak (Revisi Dikehendaki)
              </div>
              {activeTower.alasanPenolakan && (
                <p className="text-muted-foreground italic">
                  &quot;{activeTower.alasanPenolakan}&quot;
                </p>
              )}
              <p className="text-foreground font-medium pt-1">
                Mengedit dan menyimpan data ini akan mengajukan ulang tower ke status <strong>PENDING (Menunggu Verifikasi)</strong>.
              </p>
            </div>
          )}

          <form onSubmit={handleSaveTower} className="space-y-4 py-2 text-sm">
            {/* Row 1: Nama Tower & Static Height Select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="form-nama">Nama Tower <span className="text-destructive">*</span></Label>
                <Input
                  id="form-nama"
                  placeholder="Contoh: Tower BTS Babat Siku"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                />
              </div>

              {/* Static Select Ketinggian Tower */}
              <div className="space-y-1.5">
                <Label htmlFor="form-tinggi">Ketinggian / Kategori Tower</Label>
                <select
                  id="form-tinggi"
                  value={formTinggi}
                  onChange={(e) => setFormTinggi(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-xs focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="">-- Pilih Kategori Ketinggian --</option>
                  {TOWER_HEIGHT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Wilayah Kecamatan & Desa */}
            <div className="border border-hairline bg-[var(--color-canvas-soft)]/40 p-3 rounded-lg space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" />
                Lokasi Wilayah
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="form-kec">Kecamatan <span className="text-destructive">*</span></Label>
                  <select
                    id="form-kec"
                    value={formKecId}
                    onChange={(e) => {
                      const kecId = e.target.value
                      setFormKecId(kecId)
                      setFormDesaId('')
                      fetchFormDesas(kecId)
                    }}
                    className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-xs focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <option value="">-- Pilih Kecamatan --</option>
                    {allKecamatans.map(k => (
                      <option key={k.id} value={k.id}>{k.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="form-desa">Desa/Kelurahan</Label>
                  <select
                    id="form-desa"
                    disabled={!formKecId || formDesasLoading}
                    value={formDesaId}
                    onChange={(e) => setFormDesaId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-xs focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
                  >
                    <option value="">{formDesasLoading ? 'Memuat desa...' : '-- Pilih Desa --'}</option>
                    {formDesas.map(d => (
                      <option key={d.id} value={d.id}>{d.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 3: Latitude & Longitude */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="form-lat">Latitude <span className="text-destructive">*</span></Label>
                <Input
                  id="form-lat"
                  type="number"
                  step="any"
                  placeholder="Contoh: -3.654321"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Garis lintang lokasi tower. Gunakan GPS atau Google Maps.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-lng">Longitude <span className="text-destructive">*</span></Label>
                <Input
                  id="form-lng"
                  type="number"
                  step="any"
                  placeholder="Contoh: 103.789012"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Garis bujur lokasi tower. Gunakan GPS atau Google Maps.</p>
              </div>
            </div>

            {/* Duplicate Tower Warning */}
            {nearbyDuplicate && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <p>
                  Terdapat tower lain di dekat lokasi ini: <strong>{nearbyDuplicate.tower.namaTower}</strong> (jarak {nearbyDuplicate.distance} meter).
                  Periksa kembali koordinat untuk menghindari pengajuan ganda.
                </p>
              </div>
            )}

            {/* Deskripsi Lokasi */}
            <div className="space-y-1.5">
              <Label htmlFor="form-deskripsi">Deskripsi Lokasi / Alamat Lengkap</Label>
              <Textarea
                id="form-deskripsi"
                placeholder="Petunjuk jalan, patokan lokasi tower..."
                rows={2}
                value={formDeskripsi}
                onChange={(e) => setFormDeskripsi(e.target.value)}
              />
            </div>

            {/* Checkbox Groups: Operator, Teknologi, Media */}
            <div className="space-y-3 pt-1">
              {/* Operator */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Radio size={12} className="text-primary" /> Operator Seluler Terpasang
                </Label>
                <div className="flex flex-wrap gap-2 p-2.5 border border-hairline rounded-lg bg-[var(--color-canvas-soft)]/20">
                  {allOperators.map(op => {
                    const isChecked = selectedOpIds.includes(op.id)
                    return (
                      <label key={op.id} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer bg-background px-2.5 py-1 rounded-md border border-hairline shadow-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOpIds([...selectedOpIds, op.id])
                            else setSelectedOpIds(selectedOpIds.filter(id => id !== op.id))
                          }}
                          className="rounded text-primary focus:ring-primary"
                        />
                        {op.nama}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Teknologi */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Wifi size={12} className="text-primary" /> Teknologi Sinyal
                </Label>
                <div className="flex flex-wrap gap-2 p-2.5 border border-hairline rounded-lg bg-[var(--color-canvas-soft)]/20">
                  {allTeknologi.map(tek => {
                    const isChecked = selectedTekIds.includes(tek.id)
                    return (
                      <label key={tek.id} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer bg-background px-2.5 py-1 rounded-md border border-hairline shadow-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTekIds([...selectedTekIds, tek.id])
                            else setSelectedTekIds(selectedTekIds.filter(id => id !== tek.id))
                          }}
                          className="rounded text-primary focus:ring-primary"
                        />
                        {tek.nama}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Media Transmisi */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <Network size={12} className="text-primary" /> Media Transmisi
                </Label>
                <div className="flex flex-wrap gap-2 p-2.5 border border-hairline rounded-lg bg-[var(--color-canvas-soft)]/20">
                  {allMedia.map(m => {
                    const isChecked = selectedMediaIds.includes(m.id)
                    return (
                      <label key={m.id} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer bg-background px-2.5 py-1 rounded-md border border-hairline shadow-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMediaIds([...selectedMediaIds, m.id])
                            else setSelectedMediaIds(selectedMediaIds.filter(id => id !== m.id))
                          }}
                          className="rounded text-primary focus:ring-primary"
                        />
                        {m.nama}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Multiple Photo Selector in Form with Verification & Auto-minimize Notice */}
            <div className="border border-hairline bg-[var(--color-canvas-soft)]/40 p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="form-photos" className="text-xs font-semibold flex items-center gap-1">
                  <Camera size={13} className="text-primary" />
                  Lampirkan Foto Site (Multiple File)
                </Label>
                <span className="text-[10px] text-muted-foreground font-mono">Opsional</span>
              </div>

              <Input
                id="form-photos"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleSelectFiles(e.target.files, setFormPhotos)}
                className="text-xs"
              />

              {/* Verification & Auto-compress Notice */}
              {formPhotos.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-foreground">Foto Dipilih ({formPhotos.length}):</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {formPhotos.map((f, idx) => {
                      const isLarge = f.size > MAX_AUTO_COMPRESS_SIZE
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs bg-background p-1.5 rounded border border-hairline">
                          <span className="truncate max-w-[240px] text-muted-foreground font-mono text-[11px]">{f.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {(f.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                            {isLarge ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded" title="Otomatis dikompresi oleh sistem ke resolusi HD & JPEG quality 75%">
                                <Sparkles size={10} /> Auto Minimize (&gt;3MB)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-success/10 text-success px-1.5 py-0.5 rounded">
                                <Check size={10} /> Valid
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setFormPhotos(formPhotos.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive p-0.5"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Photo Count Warning */}
            {photoCountWarning && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-800">
                <Camera size={14} className="shrink-0 mt-0.5 text-blue-500" />
                <p>Lampirkan minimal 2 foto fisik tower (tampak depan dan tampak samping) untuk mempermudah proses verifikasi data.</p>
              </div>
            )}

            {formError && <p className="text-xs text-destructive font-medium">{formError}</p>}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowFormModal(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                {activeTower ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================================
          ─── MODAL: VERIFIKASI TOWER (SUPER ADMIN) ───
          ========================================================== */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-amber-600" />
              <span>Verifikasi Pengajuan Tower</span>
            </DialogTitle>
            <DialogDescription>
              Tinjau usulan tower dari <strong>{activeTower?.user?.nama}</strong> dan tentukan persetujuan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifySubmit} className="space-y-4 py-2 text-sm">
            {/* Tower Summary Box */}
            <div className="p-3 border border-hairline rounded-lg bg-[var(--color-canvas-soft)]/50 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama Tower:</span>
                <span className="font-semibold text-foreground">{activeTower?.namaTower}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wilayah:</span>
                <span className="font-medium text-foreground">
                  {activeTower?.desaKelurahan?.nama ? `${activeTower.desaKelurahan.nama}, ` : ''}
                  Kec. {activeTower?.kecamatan?.nama}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Koordinat:</span>
                <span className="font-mono text-foreground">{activeTower?.latitude}, {activeTower?.longitude}</span>
              </div>
            </div>

            {/* Status Choice */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Keputusan Verifikasi <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVerifyStatus('APPROVED')}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-all ${verifyStatus === 'APPROVED'
                      ? 'border-success bg-success/10 text-success ring-1 ring-success'
                      : 'border-hairline text-muted-foreground hover:bg-muted/50'
                    }`}
                >
                  <CheckCircle2 size={16} /> Disetujui
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyStatus('REJECTED')}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-medium transition-all ${verifyStatus === 'REJECTED'
                      ? 'border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive'
                      : 'border-hairline text-muted-foreground hover:bg-muted/50'
                    }`}
                >
                  <XCircle size={16} /> Ditolak (Revisi)
                </button>
              </div>
            </div>

            {/* Rejection reason input */}
            {verifyStatus === 'REJECTED' && (
              <div className="space-y-1.5 animate-in fade-in duration-300">
                <Label htmlFor="verify-alasan" className="text-xs text-destructive font-semibold">
                  Alasan Penolakan <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="verify-alasan"
                  rows={3}
                  placeholder="Jelaskan alasan penolakan atau kekurangan data agar dapat diperbaiki oleh Pemdes..."
                  value={verifyAlasan}
                  onChange={(e) => setVerifyAlasan(e.target.value)}
                  className="border-destructive/50 focus-visible:ring-destructive"
                />
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowVerifyModal(false)}>Batal</Button>
              <Button type="submit" disabled={submitting} variant={verifyStatus === 'REJECTED' ? 'destructive' : 'default'}>
                {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Simpan Keputusan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================================
          ─── MODAL: DETAIL TOWER & GALERI FOTO ───
          ========================================================== */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TowerControl size={20} className="text-primary" />
                <span>Detail Tower Telepon</span>
              </span>
              {detailTower && renderStatusBadge(detailTower.statusVerifikasi)}
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap teknis, penanggung jawab, serta foto dokumentasi site.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : detailTower ? (
            <div className="space-y-5 text-sm py-1">
              {/* Alert penolakan if rejected */}
              {detailTower.statusVerifikasi === 'REJECTED' && detailTower.alasanPenolakan && (
                <div className="p-3 border border-destructive/30 bg-destructive/10 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-destructive flex items-center gap-1">
                    <XCircle size={14} /> Catatan Penolakan:
                  </div>
                  <p className="text-foreground italic">&quot;{detailTower.alasanPenolakan}&quot;</p>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 border border-hairline p-3 rounded-lg bg-[var(--color-canvas-soft)]/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Informasi Umum</span>
                  <div>
                    <div className="text-xs text-muted-foreground">Nama Tower</div>
                    <div className="font-semibold text-foreground">{detailTower.namaTower}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Ketinggian</div>
                    <div className="font-medium text-foreground">{detailTower.tinggiKategori || 'Tidak diisi'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pemohon / Pengaju</div>
                    <div className="font-medium text-foreground">{detailTower.user?.nama} ({detailTower.user?.role})</div>
                  </div>
                </div>

                <div className="space-y-2 border border-hairline p-3 rounded-lg bg-[var(--color-canvas-soft)]/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Lokasi & Koordinat</span>
                  <div>
                    <div className="text-xs text-muted-foreground">Wilayah</div>
                    <div className="font-medium text-foreground">
                      {detailTower.desaKelurahan?.nama ? `${detailTower.desaKelurahan.nama}, ` : ''}
                      Kec. {detailTower.kecamatan?.nama}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Koordinat (Lat, Lng)</div>
                    <div className="font-mono text-xs text-foreground font-semibold">
                      {detailTower.latitude}, {detailTower.longitude}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Deskripsi / Patokan</div>
                    <div className="text-xs text-foreground">{detailTower.deskripsiLokasi || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Badges: Operator, Tech, Media */}
              <div className="border border-hairline p-3.5 rounded-lg space-y-3">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Operator Terpasang:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailTower.towerOperator.map(op => (
                      <span key={op.operator.id} className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {op.operator.nama}
                      </span>
                    ))}
                    {detailTower.towerOperator.length === 0 && <span className="text-xs text-muted-foreground italic">Tidak ada</span>}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Teknologi Sinyal:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailTower.towerTeknologi.map(t => (
                      <span key={t.teknologi.id} className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {t.teknologi.nama}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Media Transmisi:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailTower.towerMedia.map(m => (
                      <span key={m.mediaTransmisi.id} className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {m.mediaTransmisi.nama}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Photos Gallery */}
              <div className="border-t border-hairline pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Camera size={14} className="text-primary" />
                    Dokumentasi Foto Site ({detailTower.foto?.length || 0})
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setShowDetailModal(false)
                      openUploadModal(detailTower)
                    }}
                  >
                    <Upload size={12} className="mr-1" /> Unggah Multiple Foto
                  </Button>
                </div>

                {detailTower.foto && detailTower.foto.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detailTower.foto.map((f) => (
                      <div key={f.id} className="group relative border border-hairline rounded-lg overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.url}
                          alt={f.keterangan || detailTower.namaTower}
                          className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="p-2 bg-background/90 text-[10px] space-y-0.5">
                          <p className="font-medium text-foreground truncate">{f.keterangan || 'Tanpa keterangan'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(f.id)}
                          className="absolute top-1.5 right-1.5 bg-destructive text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Hapus foto ini"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 border border-dashed border-hairline rounded-lg text-center text-xs text-muted-foreground">
                    Belum ada foto dokumentasi untuk tower ini.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================================
          ─── MODAL: UPLOAD MULTIPLE FOTO TOWER ───
          ========================================================== */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload size={18} className="text-primary" />
              <span>Unggah Multiple Foto Site Tower</span>
            </DialogTitle>
            <DialogDescription>
              Lampirkan foto fisik site tower untuk <strong>{activeTower?.namaTower}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadPhotoSubmit} className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="upload-files">Pilih Gambar (Multiple File) <span className="text-destructive">*</span></Label>
              <Input
                id="upload-files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleSelectFiles(e.target.files, setUploadFiles)}
              />
              <span className="text-[10px] text-muted-foreground">
                Format: JPEG, PNG, WebP. File &gt;3MB otomatis dikompresi oleh sistem.
              </span>
            </div>

            {/* List preview selected files */}
            {uploadFiles.length > 0 && (
              <div className="space-y-1.5 border border-hairline p-2.5 rounded-lg bg-[var(--color-canvas-soft)]/30">
                <p className="text-[11px] font-semibold text-foreground">Daftar Foto Akan Diunggah ({uploadFiles.length}):</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {uploadFiles.map((f, idx) => {
                    const isLarge = f.size > MAX_AUTO_COMPRESS_SIZE
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs bg-background p-1.5 rounded border border-hairline">
                        <span className="truncate max-w-[220px] text-muted-foreground font-mono text-[11px]">{f.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {(f.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                          {isLarge ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded" title="Otomatis dikompresi oleh sistem ke resolusi HD & JPEG quality 75%">
                              <Sparkles size={10} /> Auto Minimize
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-success/10 text-success px-1.5 py-0.5 rounded">
                              <Check size={10} /> Valid
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setUploadFiles(uploadFiles.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="upload-caption">Keterangan Foto (Opsional)</Label>
              <Input
                id="upload-caption"
                placeholder="Contoh: Dokumentasi kondisi fisik tower"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)}>Batal</Button>
              <Button type="submit" disabled={uploading || uploadFiles.length === 0}>
                {uploading && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Unggah ({uploadFiles.length}) Foto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==========================================================
          ─── MODAL: HAPUS TOWER ───
          ========================================================== */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader className="items-center sm:text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertCircle size={24} />
            </div>
            <DialogTitle>Hapus Data Tower?</DialogTitle>
            <DialogDescription className="text-center">
              Apakah Anda yakin ingin menghapus tower <strong>{activeTower?.namaTower}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={submitting}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteTowerSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
