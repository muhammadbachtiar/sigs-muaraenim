'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import {
  TowerControl, Plus, Search, MapPin, Map, Pencil, CheckCircle2, AlertCircle,
  XCircle, Clock, Eye, Trash2, Camera, Upload, Loader2, RefreshCw,
  ShieldCheck, ArrowUpRight, FileText, Check, X, Building, Radio, Wifi, Network,
  ImageIcon, Sparkles, AlertTriangle, LayoutGrid, List, Save
} from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { saveDraft, updateDraft, getDraftsByType, getDraftById, deleteDraft, type Draft } from '@/lib/indexedDb'

const TowerMap = dynamic(() => import('@/components/map/TowerMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] rounded-xl border border-hairline bg-[var(--color-surface)] flex items-center justify-center text-xs text-muted-foreground">
      <Loader2 size={18} className="animate-spin mr-2" /> Memuat Peta Tower...
    </div>
  ),
})

const MapCoordinatePicker = dynamic(() => import('@/components/map/MapCoordinatePicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] rounded-xl border border-hairline bg-[var(--color-surface)] flex items-center justify-center">
      <Loader2 size={18} className="animate-spin text-muted-foreground" />
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
import SearchableSelect from '@/components/ui/searchable-select'
import { scrollToFirstError } from '@/lib/scroll-to-error'
import { detectDesaFromCoords } from '@/lib/spatial-helpers'

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

type TowerFormErrors = {
  namaTower?: string
  kecamatanId?: string
  desaKelurahanId?: string
  latitude?: string
  longitude?: string
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function TowerPage() {
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
  const [showTowerMapPicker, setShowTowerMapPicker] = useState(false)

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
  const [formErrors, setFormErrors] = useState<TowerFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [formCoordMode, setFormCoordMode] = useState<'none' | 'map' | 'manual'>('none')
  const [formGettingLocation, setFormGettingLocation] = useState(false)

  // Verification Form State (Super Admin)
  const [verifyStatus, setVerifyStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [verifyAlasan, setVerifyAlasan] = useState('')

  // Upload Foto Modal Form State (Multiple Upload)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  // Draft States for Tower Form
  const [existingTowerDraft, setExistingTowerDraft] = useState<Draft | null>(null)
  const [activeTowerDraftId, setActiveTowerDraftId] = useState<number | null>(null)
  const [showTowerDraftConfirmModal, setShowTowerDraftConfirmModal] = useState(false)
  const [savingTowerDraft, setSavingTowerDraft] = useState(false)

  // Map focus center — updated when user picks kec/desa (so map flies to that area)
  const [mapFocusCenter, setMapFocusCenter] = useState<[number, number] | null>(null)
  // Whether auto-detection of desa from coords is in progress
  const [detectingDesaFromCoords, setDetectingDesaFromCoords] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coordDetectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // --- AUTO-DETECT DESA/KEC FROM MANUALLY-TYPED COORDINATES ---
  // When user types lat/lng and hasn't selected kec/desa yet, detect them automatically after 700ms
  useEffect(() => {
    if (coordDetectTimer.current) clearTimeout(coordDetectTimer.current)
    const lat = parseFloat(formLat)
    const lng = parseFloat(formLng)
    if (isNaN(lat) || isNaN(lng) || !formLat || !formLng) return
    // Only auto-detect if kecamatan or desa is not yet filled
    if (formKecId && formDesaId) return
    coordDetectTimer.current = setTimeout(async () => {
      setDetectingDesaFromCoords(true)
      try {
        const detected = await detectDesaFromCoords(lat, lng)
        if (!detected) return
        // Match against allDesas from DB by name
        const foundDesa = allDesas.find(
          d => d.nama.toLowerCase().trim() === detected.desaNama.toLowerCase().trim()
        )
        if (!foundDesa) return
        const kecId = foundDesa.kecamatanId || (foundDesa as any).kecamatan?.id
        if (!formKecId && kecId) {
          setFormKecId(kecId)
          fetchFormDesas(kecId)
        }
        if (!formDesaId && foundDesa.id) {
          setFormDesaId(foundDesa.id)
        }
        toast.info(`Wilayah terdeteksi: ${detected.desaNama} (${detected.kecamatanNama})`, { id: 'coord-detect' })
      } catch {
        // ignore
      } finally {
        setDetectingDesaFromCoords(false)
      }
    }, 700)
    return () => { if (coordDetectTimer.current) clearTimeout(coordDetectTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formLat, formLng])

  // --- FOCUS MAP ON SELECTED KEC/DESA ---
  // When user picks a desa/kecamatan first (before placing the pin),
  // derive a focus center from the desa's lat/lng or the kecamatan's first desa center
  useEffect(() => {
    // If coordinates are already placed, don't override (user can see their own pin)
    if (formLat && formLng) return

    if (formDesaId) {
      const selectedDesa = allDesas.find(d => d.id === formDesaId) as any
      if (selectedDesa?.latitude != null && selectedDesa?.longitude != null) {
        setMapFocusCenter([Number(selectedDesa.latitude), Number(selectedDesa.longitude)])
        return
      }
    }
    if (formKecId && !formDesaId) {
      // Use center of first desa in that kecamatan that has coords
      const firstDesaWithCoords = allDesas.find(
        d => d.kecamatanId === formKecId && (d as any).latitude != null && (d as any).longitude != null
      ) as any
      if (firstDesaWithCoords) {
        setMapFocusCenter([Number(firstDesaWithCoords.latitude), Number(firstDesaWithCoords.longitude)])
        return
      }
    }
    // No desa/kec selected or no coords available
    setMapFocusCenter(null)
  }, [formDesaId, formKecId, allDesas, formLat, formLng])

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

      // Fetch All Desas
      fetch('/api/master/desa?is_select=true')
        .then(r => r.json())
        .then(res => {
          if (res.success) {
            setAllDesas(res.data)
            setFilterDesas(res.data)
            setFormDesas(res.data)
          }
        })
        .catch(err => console.error(err))

      fetch('/api/tower?for_map=true')
        .then(r => r.json())
        .then(res => { if (res.success) setAllTowersForDuplicate(res.data) })
        .catch(err => console.error(err))
    }
  }, [status])

  // Filter desas when filter kecamatan changes
  useEffect(() => {
    if (filterKecId && allDesas.length > 0) {
      setFilterDesas(allDesas.filter(d => d.kecamatanId === filterKecId))
    } else {
      setFilterDesas(allDesas)
    }
  }, [filterKecId, allDesas])

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
  const handleOpenAddForm = () => {
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
    setFormError('')
    setFormErrors({})
    setFormCoordMode('none')
    setShowTowerMapPicker(false)
    setActiveTowerDraftId(null)

    // Check IndexedDB for saved tower draft
    getDraftsByType('tower').then(drafts => {
      if (drafts.length > 0) {
        setExistingTowerDraft(drafts[0])
      } else {
        setExistingTowerDraft(null)
      }
    }).catch(() => {})

    setShowFormModal(true)
  }

  const handleFormGetLocation = () => {
    if (!navigator.geolocation) return
    setFormGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(String(pos.coords.latitude))
        setFormLng(String(pos.coords.longitude))
        setFormGettingLocation(false)
        toast.success('Koordinat berhasil diambil dari GPS')
      },
      () => {
        setFormGettingLocation(false)
        toast.error('Gagal mendapatkan lokasi. Pastikan izin lokasi diberikan.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // --- OPEN MODAL HANDLERS ---
  const openAddModal = () => {
    handleOpenAddForm()
  }

  // Auto-open form from shortcut (?action=create&draftId=123)
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      const draftId = searchParams.get('draftId')
      if (draftId) {
        getDraftById(Number(draftId)).then(draft => {
          if (draft && draft.data) {
            handleOpenAddForm()
            handleApplyTowerDraft(draft)
          } else {
            openAddModal()
          }
        }).catch(() => openAddModal())
      } else {
        openAddModal()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const openEditModal = async (tower: TowerItem) => {
    setActiveTower(tower)
    setFormError('')
    setFormErrors({})
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

  // Dirty check for Tower Form
  const isTowerFormDirty = useCallback(() => {
    if (activeTower) return false
    return !!(
      formNama.trim() ||
      formKecId ||
      formDesaId ||
      formLat ||
      formLng ||
      formDeskripsi.trim() ||
      selectedOpIds.length > 0 ||
      selectedTekIds.length > 0 ||
      formPhotos.length > 0
    )
  }, [activeTower, formNama, formKecId, formDesaId, formLat, formLng, formDeskripsi, selectedOpIds, selectedTekIds, formPhotos])

  const handleAttemptCloseTowerForm = () => {
    if (isTowerFormDirty()) {
      setShowTowerDraftConfirmModal(true)
    } else {
      setShowFormModal(false)
    }
  }

  const handleApplyTowerDraft = (draft: Draft) => {
    if (draft.data) {
      const d = draft.data
      if (d.namaTower) setFormNama(d.namaTower)
      if (d.tinggiKategori) setFormTinggi(d.tinggiKategori)
      if (d.kecamatanId) {
        setFormKecId(d.kecamatanId)
        fetchFormDesas(d.kecamatanId)
      }
      if (d.desaKelurahanId) setFormDesaId(d.desaKelurahanId)
      if (d.latitude != null) setFormLat(String(d.latitude))
      if (d.longitude != null) setFormLng(String(d.longitude))
      if (d.deskripsiLokasi) setFormDeskripsi(d.deskripsiLokasi)
      if (Array.isArray(d.operatorIds)) setSelectedOpIds(d.operatorIds)
      if (Array.isArray(d.teknologiIds)) setSelectedTekIds(d.teknologiIds)
      if (Array.isArray(d.mediaIds)) setSelectedMediaIds(d.mediaIds)

      setActiveTowerDraftId(draft.id!)
      setExistingTowerDraft(null)
      toast.info('Draf pengajuan tower berhasil dimuat ke form')
    }
  }

  const handleSaveTowerDraft = async () => {
    setSavingTowerDraft(true)
    try {
      const draftPayload = {
        namaTower: formNama.trim(),
        tinggiKategori: formTinggi || null,
        kecamatanId: formKecId,
        desaKelurahanId: formDesaId || null,
        latitude: formLatNum,
        longitude: formLngNum,
        deskripsiLokasi: formDeskripsi.trim() || null,
        operatorIds: selectedOpIds,
        teknologiIds: selectedTekIds,
        mediaIds: selectedMediaIds,
      }

      const label = formNama.trim() || 'Draf Pengajuan Tower Baru'

      if (activeTowerDraftId) {
        await updateDraft({
          id: activeTowerDraftId,
          type: 'tower',
          data: draftPayload,
          createdAt: new Date().toISOString(),
          wasOffline: !navigator.onLine,
          label,
        })
        toast.success('Draf pengajuan tower berhasil diperbarui ke Draf Lokal')
      } else {
        await saveDraft({
          type: 'tower',
          data: draftPayload,
          createdAt: new Date().toISOString(),
          wasOffline: !navigator.onLine,
          label,
        })
        toast.success('Draf pengajuan tower berhasil disimpan. Anda dapat melanjutkannya dari menu Draf.')
      }
      setShowTowerDraftConfirmModal(false)
      setShowFormModal(false)
    } catch {
      toast.error('Gagal menyimpan draf tower')
    } finally {
      setSavingTowerDraft(false)
    }
  }
  const handleSaveTower = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: TowerFormErrors = {}
    if (!formNama.trim()) errors.namaTower = 'Nama tower wajib diisi'
    if (!formKecId) errors.kecamatanId = 'Kecamatan lokasi wajib dipilih'

    const latNum = parseFloat(formLat)
    const lngNum = parseFloat(formLng)
    if (!formLat) errors.latitude = 'Latitude wajib diisi'
    else if (isNaN(latNum) || latNum < -90 || latNum > 90) errors.latitude = 'Latitude harus angka antara -90 dan 90'

    if (!formLng) errors.longitude = 'Longitude wajib diisi'
    else if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) errors.longitude = 'Longitude harus angka antara -180 dan 180'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      scrollToFirstError('[role="dialog"]')
      return
    }

    setFormErrors({})
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

      {/* Stats Cards — Standardized & Clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'ALL' as const, label: 'Total Tower', sub: 'Semua Status', value: totalAll, color: '#0075de', Icon: TowerControl },
          { key: 'PENDING' as const, label: 'Perlu Verifikasi', sub: 'Menunggu Persetujuan', value: totalPending, color: '#d97706', Icon: Clock },
          { key: 'APPROVED' as const, label: 'Disetujui', sub: 'Terverifikasi Aktif', value: totalApproved, color: '#16a34a', Icon: CheckCircle2 },
          { key: 'REJECTED' as const, label: 'Ditolak / Revisi', sub: 'Perlu Perbaikan Data', value: totalRejected, color: '#dc2626', Icon: XCircle },
        ].map((s) => {
          const isActive = statusFilter === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => { setStatusFilter(s.key); setPage(1) }}
              className={`flex flex-col text-left px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-elevated ${
                isActive
                  ? 'border-primary ring-1 ring-primary/30 shadow-soft bg-card'
                  : 'border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-soft hover:border-[var(--color-primary)]/40'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.color}18` }}>
                  <s.Icon size={16} style={{ color: s.color }} />
                </div>
              </div>
              <div className="flex items-baseline justify-between mt-1.5 w-full">
                <span className="text-2xl font-bold font-mono tracking-tight" style={{ color: s.color }}>
                  {s.value.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium text-right leading-tight">{s.sub}</span>
              </div>
              {isActive && (
                <p className="text-[10px] text-[var(--color-primary)] font-medium mt-1">Filter aktif ✓</p>
              )}
            </button>
          )
        })}
      </div>

      {/* Level 4: Search & Smart Filter + View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama tower, deskripsi, atau pemohon..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Smart Select Kecamatan */}
          <SearchableSelect
            options={allKecamatans.map(k => ({ value: k.id, label: k.nama }))}
            value={filterKecId}
            onChange={(val) => { setFilterKecId(val); setFilterDesaId(''); setPage(1) }}
            placeholder="-- Semua Kecamatan --"
            searchPlaceholder="Cari kecamatan..."
            className="h-9 text-xs w-full sm:w-[170px]"
          />

          {/* Smart Select Desa (filtered by kecamatan) */}
          <SearchableSelect
            options={filterDesas.map(d => ({ value: d.id, label: d.nama }))}
            value={filterDesaId}
            onChange={(val) => { setFilterDesaId(val); setPage(1) }}
            placeholder="-- Semua Desa --"
            searchPlaceholder="Cari desa..."
            disabled={!filterKecId}
            className="h-9 text-xs w-full sm:w-[170px]"
          />

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
              className="h-9 px-2 text-xs text-muted-foreground hover:text-red-500"
            >
              <X size={14} className="mr-1" /> Reset Filter
            </Button>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center border border-[var(--color-hairline)] rounded-lg p-0.5 bg-[var(--color-surface)] shadow-xs shrink-0 self-end sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'grid' ? 'bg-[var(--color-primary)] text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            title="Tampilan Kartu"
          >
            <LayoutGrid size={14} /> Kartu
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'table' ? 'bg-[var(--color-primary)] text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            title="Tampilan Tabel"
          >
            <List size={14} /> Tabel
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'map' ? 'bg-[var(--color-primary)] text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
            title="Tampilan Peta"
          >
            <Map size={14} /> Peta
          </button>
        </div>
      </div>

      {/* Main Content Area: Grid View vs Table View vs Map View */}
      {viewMode === 'map' ? (
        <TowerMap
          filterKecId={filterKecId}
          filterDesaId={filterDesaId}
          kecamatanList={allKecamatans}
          desaList={filterDesas}
          onSelectKecamatan={(id) => {
            setFilterKecId(id)
            setFilterDesaId('')
            setPage(1)
          }}
          onSelectDesa={(id) => {
            setFilterDesaId(id)
            setPage(1)
          }}
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
      <Dialog open={showFormModal} onOpenChange={(v) => !v && handleAttemptCloseTowerForm()}>
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

          {/* Draft Restoration Alert Banner */}
          {existingTowerDraft && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 truncate">
                <FileText size={15} className="shrink-0 text-amber-600" />
                <span className="truncate">
                  Draf tersimpan: <strong>{existingTowerDraft.label}</strong> ({new Date(existingTowerDraft.createdAt).toLocaleDateString('id-ID')})
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => handleApplyTowerDraft(existingTowerDraft)}
                  className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 font-semibold transition-colors text-[11px]"
                >
                  Gunakan Draf
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteDraft(existingTowerDraft.id!).then(() => {
                      setExistingTowerDraft(null)
                      toast.info('Draf dihapus')
                    })
                  }}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="Abaikan & hapus draf ini"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

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
                  onChange={(e) => {
                    setFormNama(e.target.value)
                    if (formErrors.namaTower) setFormErrors(prev => ({ ...prev, namaTower: undefined }))
                  }}
                  className={formErrors.namaTower ? 'border-red-400 ring-1 ring-red-200' : ''}
                />
                {formErrors.namaTower && <p className="text-xs text-red-500 mt-1">{formErrors.namaTower}</p>}
              </div>

              {/* Static Select Ketinggian Tower */}
              <div className="space-y-1.5">
                <Label htmlFor="form-tinggi">Ketinggian / Kategori Tower</Label>
                <SearchableSelect
                  id="form-tinggi"
                  options={TOWER_HEIGHT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  value={formTinggi}
                  onChange={setFormTinggi}
                  placeholder="-- Pilih Kategori Ketinggian --"
                  searchPlaceholder="Cari kategori..."
                />
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
                  <SearchableSelect
                    id="form-kec"
                    options={allKecamatans.map(k => ({ value: k.id, label: k.nama }))}
                    value={formKecId}
                    onChange={(val) => {
                      setFormKecId(val)
                      setFormDesaId('')
                      fetchFormDesas(val)
                      if (formErrors.kecamatanId) setFormErrors(prev => ({ ...prev, kecamatanId: undefined }))
                    }}
                    placeholder="-- Pilih Kecamatan --"
                    searchPlaceholder="Cari kecamatan..."
                  />
                  {formErrors.kecamatanId && <p className="text-xs text-red-500 mt-1">{formErrors.kecamatanId}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="form-desa">Desa/Kelurahan</Label>
                  <SearchableSelect
                    id="form-desa"
                    options={(formKecId ? formDesas : allDesas).map(d => ({
                      value: d.id,
                      label: formKecId
                        ? d.nama
                        : `${allKecamatans.find(k => k.id === d.kecamatanId)?.nama || 'Desa'} / ${d.nama}`
                    }))}
                    value={formDesaId}
                    onChange={(val) => {
                      setFormDesaId(val)
                      // If desa selected directly without kecamatan, auto-fill kecamatan
                      if (val && !formKecId) {
                        const matchedDesa = allDesas.find(d => d.id === val)
                        const kecId = matchedDesa?.kecamatanId || (matchedDesa as any)?.kecamatan?.id
                        if (kecId) {
                          setFormKecId(kecId)
                          fetchFormDesas(kecId)
                        }
                      }
                    }}
                    placeholder={formDesasLoading ? 'Memuat desa...' : '-- Pilih / Cari Desa --'}
                    searchPlaceholder="Cari desa..."
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Koordinat Lokasi — Form Manual Selalu Tampil & Sincronize */}
            <div className="space-y-3 border border-hairline p-3 rounded-xl bg-[var(--color-surface)]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin size={13} className="text-primary" /> Koordinat Lokasi Tower
                </h4>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFormGetLocation}
                    disabled={formGettingLocation}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {formGettingLocation ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                    Lokasi Saya
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTowerMapPicker(prev => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                      showTowerMapPicker
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'border-blue-500/30 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <Map size={12} />
                    {showTowerMapPicker ? 'Sembunyikan Peta' : 'Pilih dari Peta'}
                  </button>
                </div>
              </div>

              {/* Form Tulis Manual — SELALU DITAMPILKAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="form-lat" className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    Latitude (Lintang) <span className="text-destructive">*</span>
                    {detectingDesaFromCoords && (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Loader2 size={10} className="animate-spin" /> Mendeteksi wilayah...
                      </span>
                    )}
                  </Label>
                  <Input
                    id="form-lat"
                    type="number"
                    step="any"
                    placeholder="-3.654321"
                    value={formLat}
                    onChange={(e) => {
                      setFormLat(e.target.value)
                      if (formErrors.latitude) setFormErrors(prev => ({ ...prev, latitude: undefined }))
                    }}
                    className={`text-xs font-mono ${formErrors.latitude ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                  />
                  {formErrors.latitude && <p className="text-xs text-red-500 mt-1">{formErrors.latitude}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="form-lng" className="text-[11px] text-muted-foreground">
                    Longitude (Bujur) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="form-lng"
                    type="number"
                    step="any"
                    placeholder="103.789012"
                    value={formLng}
                    onChange={(e) => {
                      setFormLng(e.target.value)
                      if (formErrors.longitude) setFormErrors(prev => ({ ...prev, longitude: undefined }))
                    }}
                    className={`text-xs font-mono ${formErrors.longitude ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                  />
                  {formErrors.longitude && <p className="text-xs text-red-500 mt-1">{formErrors.longitude}</p>}
                </div>
              </div>

              {/* Helper: Gunakan Titik Pusat Desa (jika koordinat form belum diisi & desa punya koordinat) */}
              {!formLat && !formLng && (() => {
                const selectedDesaData = formDesas.find(d => d.id === formDesaId) as any
                if (selectedDesaData?.latitude != null && selectedDesaData?.longitude != null) {
                  return (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] text-xs text-muted-foreground">
                      <span className="truncate">
                        📍 Pusat {selectedDesaData.nama}: <code className="font-mono text-foreground font-medium">{Number(selectedDesaData.latitude).toFixed(4)}, {Number(selectedDesaData.longitude).toFixed(4)}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormLat(String(selectedDesaData.latitude))
                          setFormLng(String(selectedDesaData.longitude))
                          toast.success('Titik pusat desa digunakan')
                        }}
                        className="px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-hairline)] text-[11px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors shrink-0 ml-2"
                      >
                        Gunakan Titik Ini
                      </button>
                    </div>
                  )
                }
                if (formDesaId && (selectedDesaData?.latitude == null || selectedDesaData?.longitude == null)) {
                  return (
                    <div className="flex items-start gap-2 p-2 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                      <p>Titik pusat desa ({selectedDesaData?.nama}) belum diisi di menu Demografi.</p>
                    </div>
                  )
                }
                return null
              })()}

              {/* Map Picker Interactive */}
              {showTowerMapPicker && (() => {
                const selectedDesa = formDesas.find(d => d.id === formDesaId)
                const selectedKec = allKecamatans.find(k => k.id === formKecId)
                return (
                  <div className="mt-2 pt-2 border-t border-hairline">
                    <MapCoordinatePicker
                      latitude={formLatNum}
                      longitude={formLngNum}
                      onChange={(lat, lng) => {
                        setFormLat(String(lat))
                        setFormLng(String(lng))
                      }}
                      selectedDesaNama={selectedDesa?.nama}
                      selectedKecamatanNama={selectedKec?.nama}
                      userRole={isSuperAdmin ? 'SUPER_ADMIN' : 'PEMDES'}
                      onAutoDetectDesa={(desaNama, kecNama) => {
                        const foundDesa = allDesas.find(d => d.nama.toLowerCase().trim() === desaNama.toLowerCase().trim())
                        if (foundDesa) {
                          setFormDesaId(foundDesa.id)
                          const matchedKec = allKecamatans.find(k => k.id === foundDesa.kecamatanId || k.id === (foundDesa as any).kecamatan?.id)
                          if (matchedKec) {
                            setFormKecId(matchedKec.id)
                            fetchFormDesas(matchedKec.id)
                          }
                          toast.info(`Desa ${foundDesa.nama} (${kecNama}) terdeteksi otomatis dari koordinat`)
                        }
                      }}
                      desaCenterLat={(selectedDesa as any)?.latitude}
                      desaCenterLng={(selectedDesa as any)?.longitude}
                      focusCenter={mapFocusCenter}
                    />
                  </div>
                )
              })()}
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
              <Button type="button" variant="outline" onClick={handleAttemptCloseTowerForm}>Batal</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                {activeTower ? 'Simpan Perubahan' : 'Kirim Pengajuan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal when closing Tower form with unsaved data */}
      <Dialog open={showTowerDraftConfirmModal} onOpenChange={setShowTowerDraftConfirmModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-amber-600 font-bold text-base">
              <Save size={18} /> Simpan sebagai Draf?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Data pengajuan tower yang Anda isi belum dikirim. Simpan sebagai
              {' '}<strong className="text-foreground">Draf Lokal</strong>{' '}
              agar bisa dilanjutkan nanti?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSaveTowerDraft}
              disabled={savingTowerDraft}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold h-10"
            >
              {savingTowerDraft ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Simpan ke Draf
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTowerDraftConfirmModal(false)}
              className="w-full h-10"
            >
              Lanjutkan Mengisi
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowTowerDraftConfirmModal(false)
                setShowFormModal(false)
              }}
              className="text-xs text-muted-foreground hover:text-destructive text-center py-1 transition-colors"
            >
              Tutup tanpa menyimpan
            </button>
          </div>
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
          <DialogHeader className="pr-8 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2">
                <TowerControl size={20} className="text-primary shrink-0" />
                <span>Detail Tower Telepon</span>
              </DialogTitle>
              {detailTower && renderStatusBadge(detailTower.statusVerifikasi)}
            </div>
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
                    <div className="text-xs text-muted-foreground mb-0.5">Koordinat (Lat, Lng)</div>
                    <div className="font-mono text-xs text-foreground font-semibold flex items-center gap-2 flex-wrap">
                      <span>{detailTower.latitude}, {detailTower.longitude}</span>
                      <a
                        href={`https://www.google.com/maps?q=${detailTower.latitude},${detailTower.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                        title="Buka lokasi di Google Maps"
                      >
                        <MapPin size={11} /> Google Maps
                      </a>
                      <a
                        href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${detailTower.latitude},${detailTower.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-emerald-600 hover:text-emerald-800 hover:underline bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                        title="Buka Street View lokasi"
                      >
                        <Eye size={11} /> Street View
                      </a>
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

export default function TowerPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TowerPage />
    </Suspense>
  )
}
