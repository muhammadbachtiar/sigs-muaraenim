'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Loader2, MapPin, Map, X, Camera, TriangleAlert, TowerControl, Ban, Info, Save, FileText, Trash2, HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import SearchableSelect from '@/components/ui/searchable-select'
import { scrollToFirstError } from '@/lib/scroll-to-error'
import { detectDesaFromCoords } from '@/lib/spatial-helpers'
import { saveDraft, updateDraft, getDraftsByType, deleteDraft, type Draft } from '@/lib/indexedDb'

const MapCoordinatePicker = dynamic(() => import('@/components/map/MapCoordinatePicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] rounded-xl border border-hairline bg-[var(--color-surface)] flex items-center justify-center">
      <Loader2 size={18} className="animate-spin text-muted-foreground" />
    </div>
  ),
})

type Desa = { id: string; nama: string; latitude: number | null; longitude: number | null; kecamatanId?: string; kecamatan: { id?: string; nama: string } }
type Operator = { id: string; nama: string }
type Teknologi = { id: string; nama: string }
type TowerMapItem = { id: string; namaTower: string; latitude: number; longitude: number; desaKelurahan?: { nama: string } | null; kecamatan?: { nama: string } | null }

export type SinyalFormData = {
  id: string
  desaKelurahanId: string
  operatorId: string
  teknologiId: string
  latitude: number
  longitude: number
  rsrp: number | null
  rssi: number | null
  rsrq: number | null
  snr: number | null
  tanggalPengukuran: string
  catatan: string | null
}

type FormState = {
  desaKelurahanId: string
  operatorId: string
  teknologiId: string
  latitude: string
  longitude: string
  rsrp: string
  rssi: string
  rsrq: string
  snr: string
  tanggalPengukuran: string
  catatan: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editData?: SinyalFormData | null
  userRole: 'SUPER_ADMIN' | 'PEMDES'
  userDesaId?: string | null
}

function emptyForm(userRole: string, userDesaId?: string | null): FormState {
  return {
    desaKelurahanId: userRole === 'PEMDES' && userDesaId ? userDesaId : '',
    operatorId: '',
    teknologiId: '',
    latitude: '',
    longitude: '',
    rsrp: '',
    rssi: '',
    rsrq: '',
    snr: '',
    tanggalPengukuran: new Date().toISOString().slice(0, 16),
    catatan: '',
  }
}

function parseNum(val: string): number | null {
  if (val === '' || val === null || val === undefined) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function validateForm(form: FormState, userRole: string, userDesaId?: string | null): FormErrors {
  const errors: FormErrors = {}
  if (!form.desaKelurahanId) errors.desaKelurahanId = 'Desa/Kelurahan wajib dipilih'
  if (!form.operatorId) errors.operatorId = 'Operator wajib dipilih'
  if (!form.teknologiId) errors.teknologiId = 'Teknologi wajib dipilih'
  if (!form.tanggalPengukuran) errors.tanggalPengukuran = 'Tanggal pengukuran wajib diisi'

  const lat = parseNum(form.latitude)
  if (lat === null) errors.latitude = 'Latitude wajib diisi'
  else if (lat < -90 || lat > 90) errors.latitude = 'Latitude harus antara -90 dan 90'

  const lng = parseNum(form.longitude)
  if (lng === null) errors.longitude = 'Longitude wajib diisi'
  else if (lng < -180 || lng > 180) errors.longitude = 'Longitude harus antara -180 dan 180'

  // RSRP and RSSI are required
  if (!form.rsrp) errors.rsrp = 'RSRP wajib diisi'
  if (!form.rssi) errors.rssi = 'RSSI wajib diisi'

  return errors
}

export default function SinyalFormDialog({ open, onClose, onSuccess, editData, userRole, userDesaId }: Props) {
  const [desaList, setDesaList] = useState<Desa[]>([])
  const [operatorList, setOperatorList] = useState<Operator[]>([])
  const [teknologiList, setTeknologiList] = useState<Teknologi[]>([])
  const [towerList, setTowerList] = useState<TowerMapItem[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [form, setForm] = useState<FormState>(() => emptyForm(userRole, userDesaId))
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [coordMode, setCoordMode] = useState<'none' | 'map' | 'manual'>('none')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [isBlankspotMode, setIsBlankspotMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Draft states
  const [existingDraft, setExistingDraft] = useState<Draft | null>(null)
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null)
  const [showDraftConfirmModal, setShowDraftConfirmModal] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  const isEdit = !!editData

  useEffect(() => {
    if (!open) return
    setLoadingOptions(true)
    Promise.all([
      fetch('/api/master/desa?is_select=true').then(r => r.json()),
      fetch('/api/master/operator?page_size=50').then(r => r.json()),
      fetch('/api/master/teknologi?page_size=50').then(r => r.json()),
      fetch('/api/tower?for_map=true&include_location=true').then(r => r.json()),
    ]).then(([desa, op, tek, towers]) => {
      if (desa.success) setDesaList(desa.data)
      if (op.success) setOperatorList(op.data)
      if (tek.success) setTeknologiList(tek.data)
      if (towers.success) setTowerList(towers.data)
    }).finally(() => setLoadingOptions(false))
  }, [open])

  // Isu 9: Fix race condition — jika PEMDES dan desa belum ter-select karena loading,
  // set setelah desaList berhasil dimuat
  useEffect(() => {
    if (userRole === 'PEMDES' && userDesaId && desaList.length > 0 && !form.desaKelurahanId) {
      setField('desaKelurahanId', userDesaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desaList])

  // Auto-suggest teknologi when operator is selected
  useEffect(() => {
    if (!form.operatorId || form.teknologiId) return
    const selectedOp = operatorList.find(o => o.id === form.operatorId)
    if (!selectedOp) return
    const opName = selectedOp.nama.toLowerCase()
    const is4gOperator = ['telkomsel', 'indosat', 'xl', 'smartfren', 'tri', '3'].some(k => opName.includes(k))
    if (is4gOperator) {
      const lte = teknologiList.find(t => t.nama.toLowerCase().includes('4g') || t.nama.toLowerCase().includes('lte'))
      if (lte) setField('teknologiId', lte.id)
    }
  }, [form.operatorId])

  const selectedDesa = desaList.find(d => d.id === form.desaKelurahanId)
  const measLat = parseNum(form.latitude)
  const measLng = parseNum(form.longitude)
  const rsrpVal = parseNum(form.rsrp)

  const distanceFromCenter = useMemo(() => {
    if (!selectedDesa?.latitude || !selectedDesa?.longitude || measLat == null || measLng == null) return null
    return haversineKm(selectedDesa.latitude, selectedDesa.longitude, measLat, measLng)
  }, [selectedDesa, measLat, measLng])

  const closestTowers = useMemo(() => {
    if (measLat == null || measLng == null || towerList.length === 0) return []
    return towerList
      .map(t => ({ ...t, distance: haversineKm(measLat, measLng, t.latitude, t.longitude) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
  }, [measLat, measLng, towerList])

  const noTowerNearby = closestTowers.length > 0 && closestTowers[0].distance > 5
  const isBlankspot = rsrpVal != null && rsrpVal < -110

  useEffect(() => {
    if (!open) return
    setErrors({})
    setActiveDraftId(null)

    if (editData) {
      setForm({
        desaKelurahanId: editData.desaKelurahanId,
        operatorId: editData.operatorId,
        teknologiId: editData.teknologiId,
        latitude: String(editData.latitude),
        longitude: String(editData.longitude),
        rsrp: editData.rsrp !== null ? String(editData.rsrp) : '',
        rssi: editData.rssi !== null ? String(editData.rssi) : '',
        rsrq: editData.rsrq !== null ? String(editData.rsrq) : '',
        snr: editData.snr !== null ? String(editData.snr) : '',
        tanggalPengukuran: new Date(editData.tanggalPengukuran).toISOString().slice(0, 16),
        catatan: editData.catatan ?? '',
      })
      setExistingDraft(null)
    } else {
      setForm(emptyForm(userRole, userDesaId))
      setPendingFiles([])

      // Check IndexedDB for existing sinyal draft
      getDraftsByType('sinyal').then(drafts => {
        if (drafts.length > 0) {
          setExistingDraft(drafts[0])
        } else {
          setExistingDraft(null)
        }
      }).catch(() => {})
    }
  }, [open, editData, userRole, userDesaId])

  // Check if form is dirty (has unsaved changes)
  const isFormDirty = useCallback(() => {
    if (isEdit) return false
    return !!(
      form.operatorId ||
      form.teknologiId ||
      (form.latitude && form.latitude !== String(emptyForm(userRole, userDesaId).latitude)) ||
      (form.longitude && form.longitude !== String(emptyForm(userRole, userDesaId).longitude)) ||
      form.rsrp ||
      form.rssi ||
      form.catatan ||
      pendingFiles.length > 0
    )
  }, [isEdit, form, pendingFiles, userRole, userDesaId])

  const handleAttemptClose = () => {
    if (isFormDirty()) {
      setShowDraftConfirmModal(true)
    } else {
      onClose()
    }
  }

  const handleApplyDraft = (draft: Draft) => {
    if (draft.data) {
      setForm({
        desaKelurahanId: draft.data.desaKelurahanId || '',
        operatorId: draft.data.operatorId || '',
        teknologiId: draft.data.teknologiId || '',
        latitude: draft.data.latitude != null ? String(draft.data.latitude) : '',
        longitude: draft.data.longitude != null ? String(draft.data.longitude) : '',
        rsrp: draft.data.rsrp != null ? String(draft.data.rsrp) : '',
        rssi: draft.data.rssi != null ? String(draft.data.rssi) : '',
        rsrq: draft.data.rsrq != null ? String(draft.data.rsrq) : '',
        snr: draft.data.snr != null ? String(draft.data.snr) : '',
        tanggalPengukuran: draft.data.tanggalPengukuran || new Date().toISOString().slice(0, 16),
        catatan: draft.data.catatan || '',
      })
      setActiveDraftId(draft.id!)
      setExistingDraft(null)
      toast.info('Draf tersimpan berhasil dimuat ke form')
    }
  }

  const handleSaveAsDraft = async () => {
    setSavingDraft(true)
    try {
      const selectedOp = operatorList.find(o => o.id === form.operatorId)?.nama
      const selectedDesa = desaList.find(d => d.id === form.desaKelurahanId)?.nama
      const label = [selectedOp, selectedDesa ? `Desa ${selectedDesa}` : ''].filter(Boolean).join(' — ') || 'Draf Sinyal Baru'

      const draftPayload = {
        desaKelurahanId: form.desaKelurahanId,
        operatorId: form.operatorId,
        teknologiId: form.teknologiId,
        latitude: parseNum(form.latitude),
        longitude: parseNum(form.longitude),
        rsrp: parseNum(form.rsrp),
        rssi: parseNum(form.rssi),
        rsrq: parseNum(form.rsrq),
        snr: parseNum(form.snr),
        tanggalPengukuran: form.tanggalPengukuran,
        catatan: form.catatan,
      }

      if (activeDraftId) {
        await updateDraft({
          id: activeDraftId,
          type: 'sinyal',
          data: draftPayload,
          createdAt: new Date().toISOString(),
          wasOffline: !navigator.onLine,
          label,
        })
        toast.success('Draf sinyal berhasil diperbarui ke Draf Lokal')
      } else {
        await saveDraft({
          type: 'sinyal',
          data: draftPayload,
          createdAt: new Date().toISOString(),
          wasOffline: !navigator.onLine,
          label,
        })
        toast.success('Draf sinyal berhasil disimpan. Anda dapat melanjutkan dari menu Draf.')
      }
      setShowDraftConfirmModal(false)
      onClose()
    } catch {
      toast.error('Gagal menyimpan draf')
    } finally {
      setSavingDraft(false)
    }
  }

  const setField = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const handleMapPickerChange = (lat: number, lng: number) => {
    setField('latitude', String(lat))
    setField('longitude', String(lng))
  }

  // Auto-detect desa from coordinates (when desa not yet selected)
  const handleAutoDetectDesa = useCallback((desaNama: string, kecamatanNama: string) => {
    if (form.desaKelurahanId || userRole === 'PEMDES') return // Don't override if already selected or PEMDES
    // Find matching desa in desaList
    const cleanDesa = desaNama.toLowerCase().trim()
    const cleanKec = kecamatanNama.toLowerCase().trim()
    const found = desaList.find(d => {
      const dName = d.nama.toLowerCase().trim()
      const kName = d.kecamatan?.nama?.toLowerCase().trim()
      return dName === cleanDesa && (!cleanKec || kName === cleanKec)
    })
    if (found) {
      setField('desaKelurahanId', found.id)
      toast.info(`Desa ${found.nama} (${found.kecamatan?.nama}) terdeteksi otomatis dari koordinat`)
    }
  }, [desaList, form.desaKelurahanId, userRole])

  // Auto-detect desa when coordinates change via GPS or manual input
  useEffect(() => {
    if (form.desaKelurahanId || userRole === 'PEMDES') return
    const lat = parseNum(form.latitude)
    const lng = parseNum(form.longitude)
    if (lat == null || lng == null) return
    const timeout = setTimeout(async () => {
      const detected = await detectDesaFromCoords(lat, lng)
      if (detected) {
        handleAutoDetectDesa(detected.desaNama, detected.kecamatanNama)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [form.latitude, form.longitude, form.desaKelurahanId, userRole, handleAutoDetectDesa])

  // Blankspot toggle handler
  const toggleBlankspot = () => {
    const newMode = !isBlankspotMode
    setIsBlankspotMode(newMode)
    if (newMode) {
      setField('rsrp', '-120')
      setField('rssi', '-105')
      setField('rsrq', '')
      setField('snr', '')

      // Auto-fill Operator for Blankspot if master data entry exists
      if (!form.operatorId) {
        const blankOp = operatorList.find(o => {
          const n = o.nama.toLowerCase()
          return n.includes('blankspot') || n.includes('tidak ada') || n.includes('no service') || n.includes('n/a') || n.includes('lainnya')
        })
        if (blankOp) setField('operatorId', blankOp.id)
      }

      // Auto-fill Teknologi for Blankspot if master data entry exists
      if (!form.teknologiId) {
        const blankTek = teknologiList.find(t => {
          const n = t.nama.toLowerCase()
          return n.includes('blankspot') || n.includes('no signal') || n.includes('tidak ada') || n.includes('n/a') || n.includes('2g')
        })
        if (blankTek) setField('teknologiId', blankTek.id)
      }

      toast.info('Mode blankspot aktif: Nilai RSRP & RSSI disesuaikan untuk area tanpa sinyal')
    } else {
      setField('rsrp', '')
      setField('rssi', '')
      toast.info('Mode blankspot dinonaktifkan')
    }
  }

  const handleIdwRecommendation = (pred: { predictedRsrp: number | null; predictedRssi: number | null; predictedRsrq: number | null; predictedSnr: number | null }) => {
    if (pred.predictedRsrp != null) setField('rsrp', String(Math.round(pred.predictedRsrp)))
    if (pred.predictedRssi != null) setField('rssi', String(Math.round(pred.predictedRssi)))
    if (pred.predictedRsrq != null) setField('rsrq', String(Math.round(pred.predictedRsrq)))
    if (pred.predictedSnr != null) setField('snr', String(Math.round(pred.predictedSnr)))
    toast.success('Nilai sinyal rekomendasi IDW telah diterapkan')
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung geolocation')
      return
    }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setField('latitude', String(pos.coords.latitude))
        setField('longitude', String(pos.coords.longitude))
        setGettingLocation(false)
        toast.success('Koordinat berhasil diambil')
      },
      () => {
        setGettingLocation(false)
        toast.error('Gagal mendapatkan lokasi. Pastikan izin lokasi diberikan.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    if (valid.length < files.length) toast.warning('Beberapa file diabaikan (hanya JPEG, PNG, WebP)')
    setPendingFiles(prev => [...prev, ...valid])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadPhotos = async (sinyalId: string) => {
    if (pendingFiles.length === 0) return
    setUploadingPhotos(true)
    for (const file of pendingFiles) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('sinyal_id', sinyalId)
      await fetch('/api/upload/sinyal', { method: 'POST', body: fd })
    }
    setUploadingPhotos(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateForm(form, userRole, userDesaId)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      scrollToFirstError('[role="dialog"]')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        desaKelurahanId: form.desaKelurahanId,
        operatorId: form.operatorId,
        teknologiId: form.teknologiId,
        latitude: parseNum(form.latitude),
        longitude: parseNum(form.longitude),
        rsrp: parseNum(form.rsrp),
        rssi: parseNum(form.rssi),
        rsrq: parseNum(form.rsrq),
        snr: parseNum(form.snr),
        tanggalPengukuran: form.tanggalPengukuran,
        catatan: form.catatan || null,
      }

      const url = isEdit ? `/api/sinyal/${editData!.id}` : '/api/sinyal'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (!res.success) {
        toast.error(res.message || 'Gagal menyimpan data sinyal')
        return
      }

      if (!isEdit && res.data?.id) {
        await uploadPhotos(res.data.id)
      }

      // Cleanup draft if form was opened from draft
      if (activeDraftId) {
        await deleteDraft(activeDraftId).catch(() => {})
      }

      toast.success(isEdit ? 'Data sinyal berhasil diperbarui' : 'Data sinyal berhasil disimpan')
      onSuccess()
      onClose()
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleAttemptClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isEdit ? 'Edit Data Sinyal' : 'Input Data Sinyal'}
            </DialogTitle>
          </DialogHeader>

          {/* Draft Restoration Alert Banner */}
          {existingDraft && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 truncate">
                <FileText size={15} className="shrink-0 text-amber-600" />
                <span className="truncate">
                  Draf tersimpan: <strong>{existingDraft.label}</strong> ({new Date(existingDraft.createdAt).toLocaleDateString('id-ID')})
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => handleApplyDraft(existingDraft)}
                  className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 font-semibold transition-colors"
                >
                  Gunakan Draf
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteDraft(existingDraft.id!).then(() => {
                      setExistingDraft(null)
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

        {loadingOptions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Desa */}
            <div>
              <Label htmlFor="sf-desa" className="text-xs font-medium mb-1.5 block">Desa / Kelurahan</Label>
              {userRole === 'PEMDES' && userDesaId ? (
                <div className="text-sm px-3 py-2 rounded-lg bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] text-[var(--color-ink-secondary)] font-medium">
                  {selectedDesa?.nama ? `Desa/Kel. ${selectedDesa.nama}` : 'Desa Anda'}
                  <span className="text-xs text-muted-foreground ml-1 font-normal">(tetap)</span>
                </div>
              ) : (
                <SearchableSelect
                  id="sf-desa"
                  options={desaList.map(d => ({ value: d.id, label: `${d.kecamatan.nama} / ${d.nama}` }))}
                  value={form.desaKelurahanId}
                  onChange={val => {
                    setField('desaKelurahanId', val)
                    // Bi-directional: if a desa is selected, auto-detect was already done
                  }}
                  placeholder="— Pilih atau cari Desa/Kelurahan —"
                  searchPlaceholder="Cari desa atau kecamatan..."
                  emptyText="Desa tidak ditemukan"
                />
              )}
              {errors.desaKelurahanId && <p className="text-xs text-red-500 mt-1">{errors.desaKelurahanId}</p>}
            </div>

            {/* Operator & Teknologi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sf-operator" className="text-xs font-medium mb-1.5 block">Operator</Label>
                <SearchableSelect
                  id="sf-operator"
                  options={operatorList.map(o => ({ value: o.id, label: o.nama }))}
                  value={form.operatorId}
                  onChange={val => setField('operatorId', val)}
                  placeholder="— Pilih Operator —"
                  searchPlaceholder="Cari operator..."
                />
                {errors.operatorId && <p className="text-xs text-red-500 mt-1">{errors.operatorId}</p>}
              </div>
              <div>
                <Label htmlFor="sf-teknologi" className="text-xs font-medium mb-1.5 block">Teknologi</Label>
                <SearchableSelect
                  id="sf-teknologi"
                  options={teknologiList.map(t => ({ value: t.id, label: t.nama }))}
                  value={form.teknologiId}
                  onChange={val => setField('teknologiId', val)}
                  placeholder="— Pilih Teknologi —"
                  searchPlaceholder="Cari teknologi..."
                />
                {errors.teknologiId && <p className="text-xs text-red-500 mt-1">{errors.teknologiId}</p>}
              </div>
            </div>

            {/* Tanggal */}
            <div>
              <Label htmlFor="sf-tanggal" className="text-xs font-medium mb-1.5 block">Tanggal Pengukuran</Label>
              <Input
                id="sf-tanggal"
                type="datetime-local"
                value={form.tanggalPengukuran}
                onChange={e => setField('tanggalPengukuran', e.target.value)}
                className="text-sm"
              />
              {errors.tanggalPengukuran && <p className="text-xs text-red-500 mt-1">{errors.tanggalPengukuran}</p>}
            </div>

            {/* Section: Koordinat — Form Manual Selalu Tampil & Sincronize */}
            <div className="space-y-3 border border-[var(--color-hairline)] p-3 rounded-xl bg-[var(--color-surface)]">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin size={13} className="text-primary" /> Koordinat Lokasi
                </Label>

                {/* Buttons: Lokasi Saya (GPS) & Pilih dari Peta */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={gettingLocation}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {gettingLocation ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                    Lokasi Saya
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMapPicker(prev => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${showMapPicker
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                      : 'border-blue-500/30 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                  >
                    <Map size={12} />
                    {showMapPicker ? 'Sembunyikan Peta' : 'Pilih dari Peta'}
                  </button>
                </div>
              </div>

              {/* Form Tulis Manual — SELALU DITAMPILKAN */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sf-lat" className="text-[11px] text-muted-foreground block mb-1">
                    Latitude (Lintang) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sf-lat"
                    type="number"
                    step="any"
                    placeholder="-3.654321"
                    value={form.latitude}
                    onChange={e => setField('latitude', e.target.value)}
                    className="text-xs font-mono"
                  />
                  {errors.latitude && <p className="text-xs text-red-500 mt-1">{errors.latitude}</p>}
                </div>
                <div>
                  <Label htmlFor="sf-lng" className="text-[11px] text-muted-foreground block mb-1">
                    Longitude (Bujur) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sf-lng"
                    type="number"
                    step="any"
                    placeholder="103.789012"
                    value={form.longitude}
                    onChange={e => setField('longitude', e.target.value)}
                    className="text-xs font-mono"
                  />
                  {errors.longitude && <p className="text-xs text-red-500 mt-1">{errors.longitude}</p>}
                </div>
              </div>

              {/* Helper: Gunakan Titik Pusat Desa (jika koordinat form belum diisi & desa punya koordinat) */}
              {!form.latitude && !form.longitude && selectedDesa?.latitude != null && selectedDesa?.longitude != null && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] text-xs text-muted-foreground">
                  <span className="truncate">
                    📍 Pusat {selectedDesa.nama}: <code className="font-mono text-foreground font-medium">{selectedDesa.latitude.toFixed(4)}, {selectedDesa.longitude.toFixed(4)}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setField('latitude', String(selectedDesa.latitude))
                      setField('longitude', String(selectedDesa.longitude))
                      toast.success('Titik pusat desa digunakan')
                    }}
                    className="px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-hairline)] text-[11px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors shrink-0 ml-2"
                  >
                    Gunakan Titik Ini
                  </button>
                </div>
              )}

              {/* Warning jika desa dipilih TAPI koordinat pusat desa belum ada */}
              {!form.latitude && !form.longitude && selectedDesa && (selectedDesa.latitude == null || selectedDesa.longitude == null) && (
                <div className="flex items-start gap-2 p-2 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
                  <TriangleAlert size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <p>Titik pusat desa ({selectedDesa.nama}) belum diisi di menu Demografi.</p>
                </div>
              )}

              {/* Map Picker Interactive */}
              {showMapPicker && (
                <div className="mt-2 pt-2 border-t border-[var(--color-hairline)]">
                  <MapCoordinatePicker
                    latitude={measLat}
                    longitude={measLng}
                    onChange={handleMapPickerChange}
                    selectedDesaNama={selectedDesa?.nama}
                    selectedKecamatanNama={selectedDesa?.kecamatan?.nama}
                    userRole={userRole}
                    showIdwRecommendation={true}
                    onIdwRecommendation={handleIdwRecommendation}
                    onAutoDetectDesa={handleAutoDetectDesa}
                    desaCenterLat={selectedDesa?.latitude}
                    desaCenterLng={selectedDesa?.longitude}
                  />
                </div>
              )}
            </div>

            {/* Distance & boundary warnings are now handled by MapCoordinatePicker */}

            {selectedDesa && selectedDesa.latitude == null && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
                <MapPin size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <p>Koordinat pusat desa ({selectedDesa.nama}) belum diisi di sistem. Peringatan jarak tidak dapat dihitung.</p>
              </div>
            )}



            {closestTowers.length > 0 && (
              <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <TowerControl size={13} className="text-primary" />
                  Tower Terdekat
                </div>
                {closestTowers.map(t => (
                  <div key={t.id} className="flex items-center justify-between pl-5">
                    <span className="text-muted-foreground truncate">
                      {t.namaTower}
                      {(t.kecamatan || t.desaKelurahan) && (
                        <span className="text-[10px] text-muted-foreground/70 ml-1">
                          ({[t.kecamatan?.nama, t.desaKelurahan?.nama].filter(Boolean).join(' - ')})
                        </span>
                      )}
                    </span>
                    <span className={`font-mono font-medium ${t.distance > 5 ? 'text-amber-600' : 'text-foreground'}`}>
                      {t.distance.toFixed(1)} km
                    </span>
                  </div>
                ))}
                {noTowerNearby && (
                  <p className="text-amber-700 mt-1 pl-5">Tidak ditemukan tower dalam radius 5 km dari lokasi ini. Pastikan titik koordinat sudah sesuai atau ajukan data tower.</p>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-medium">Nilai Sinyal</Label>
                <button
                  type="button"
                  onClick={toggleBlankspot}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${isBlankspotMode
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600'
                    }`}
                >
                  <Ban size={10} />
                  {isBlankspotMode ? 'Mode Blankspot Aktif' : 'Tandai Blankspot'}
                </button>
              </div>

              {isBlankspotMode && (
                <div className="flex items-start gap-2 p-2 rounded-lg border border-red-200 bg-red-50 text-[11px] text-red-700 mb-2">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Area Blankspot / Tidak Ada Sinyal</p>
                    <p className="mt-0.5">Nilai RSRP dan RSSI telah disesuaikan untuk lokasi tanpa sinyal. Anda tetap dapat mengubah nilainya secara manual.</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground mb-2">
                RSRP dan RSSI <span className="text-red-500 font-semibold">wajib</span> diisi. RSRQ dan SNR bersifat opsional.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'sf-rsrp', key: 'rsrp' as const, label: 'RSRP (dBm)', placeholder: 'Contoh: -95', required: true },
                  { id: 'sf-rssi', key: 'rssi' as const, label: 'RSSI (dBm)', placeholder: 'Contoh: -75', required: true },
                  { id: 'sf-rsrq', key: 'rsrq' as const, label: 'RSRQ (dB)', placeholder: 'Contoh: -12', required: false },
                  { id: 'sf-snr', key: 'snr' as const, label: 'SNR (dB)', placeholder: 'Contoh: 15', required: false },
                ].map(({ id, key, label, placeholder, required }) => (
                  <div key={key}>
                    <Label htmlFor={id} className="text-xs text-muted-foreground mb-1 block">
                      {label} {required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      id={id}
                      type="number"
                      step="any"
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={e => setField(key, e.target.value)}
                      className={`text-sm ${errors[key] ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                    />
                    {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Blankspot Warning */}
            {isBlankspot && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
                <TriangleAlert size={14} className="shrink-0 mt-0.5 text-red-500" />
                <p>Hasil pengukuran menunjukkan sinyal sangat lemah (kemungkinan area blankspot). Disarankan mengunggah foto bukti tangkapan layar kondisi sinyal perangkat.</p>
              </div>
            )}

            {form.operatorId && form.teknologiId && (
              <p className="text-[10px] text-muted-foreground">*Teknologi otomatis terpilih berdasarkan operator. Anda dapat mengubahnya secara manual.</p>
            )}

            {/* Catatan */}
            <div>
              <Label htmlFor="sf-catatan" className="text-xs font-medium mb-1.5 block">Catatan (opsional)</Label>
              <Textarea
                id="sf-catatan"
                rows={2}
                placeholder="Keterangan tambahan kondisi sinyal..."
                value={form.catatan}
                onChange={e => setField('catatan', e.target.value)}
                className="text-sm resize-none"
              />
            </div>

            {/* Upload foto (hanya saat tambah) */}
            {!isEdit && (
              <div>
                <Label className="text-xs font-medium mb-1.5 block">
                  Foto Pendukung <span className="text-muted-foreground font-normal">(opsional)</span>
                </Label>
                <div
                  className="border-2 border-dashed border-[var(--color-hairline)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={20} className="mx-auto mb-1.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Klik untuk pilih foto atau ambil dari kamera</p>
                  <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, WebP — dikompres otomatis jika &gt;3MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {pendingFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {pendingFiles.map((file, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-[var(--color-hairline)] aspect-square">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-hairline)]">
              <Button type="button" variant="outline" onClick={handleAttemptClose} disabled={submitting}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting || uploadingPhotos}>
                {(submitting || uploadingPhotos) && <Loader2 size={14} className="animate-spin mr-1.5" />}
                {isEdit ? 'Simpan Perubahan' : 'Simpan Data'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>

    {/* Confirmation Modal when closing with unsaved data */}
    <Dialog open={showDraftConfirmModal} onOpenChange={setShowDraftConfirmModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-amber-600 font-bold text-base">
            <Save size={18} /> Simpan sebagai Draf?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Data sinyal yang Anda isi belum disimpan ke server. Simpan sebagai
            {' '}<strong className="text-foreground">Draf Lokal</strong>{' '}
            agar bisa dilanjutkan nanti?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            onClick={handleSaveAsDraft}
            disabled={savingDraft}
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold h-10"
          >
            {savingDraft ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Simpan ke Draf
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDraftConfirmModal(false)}
            className="w-full h-10"
          >
            Lanjutkan Mengisi
          </Button>
          <button
            type="button"
            onClick={() => {
              setShowDraftConfirmModal(false)
              onClose()
            }}
            className="text-xs text-muted-foreground hover:text-destructive text-center py-1 transition-colors"
          >
            Tutup tanpa menyimpan
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
