'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Loader2, MapPin, X, Camera, TriangleAlert, TowerControl } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type Desa = { id: string; nama: string; latitude: number | null; longitude: number | null; kecamatan: { nama: string } }
type Operator = { id: string; nama: string }
type Teknologi = { id: string; nama: string }
type TowerMapItem = { id: string; namaTower: string; latitude: number; longitude: number }

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!editData

  useEffect(() => {
    if (!open) return
    setLoadingOptions(true)
    Promise.all([
      fetch('/api/master/desa?page_size=200').then(r => r.json()),
      fetch('/api/master/operator?page_size=50').then(r => r.json()),
      fetch('/api/master/teknologi?page_size=50').then(r => r.json()),
      fetch('/api/tower?for_map=true').then(r => r.json()),
    ]).then(([desa, op, tek, towers]) => {
      if (desa.success) setDesaList(desa.data)
      if (op.success) setOperatorList(op.data)
      if (tek.success) setTeknologiList(tek.data)
      if (towers.success) setTowerList(towers.data)
    }).finally(() => setLoadingOptions(false))
  }, [open])

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
    } else {
      setForm(emptyForm(userRole, userDesaId))
      setPendingFiles([])
    }
  }, [open, editData, userRole, userDesaId])

  const setField = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Edit Data Sinyal' : 'Input Data Sinyal'}
          </DialogTitle>
        </DialogHeader>

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
                <div className="text-sm px-3 py-2 rounded-lg bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] text-[var(--color-ink-secondary)]">
                  {desaList.find(d => d.id === userDesaId)?.nama ?? 'Desa Anda'}
                  <span className="text-xs text-muted-foreground ml-1">(tetap)</span>
                </div>
              ) : (
                <select
                  id="sf-desa"
                  value={form.desaKelurahanId}
                  onChange={e => setField('desaKelurahanId', e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0"
                >
                  <option value="">— Pilih Desa/Kelurahan —</option>
                  {desaList.map(d => (
                    <option key={d.id} value={d.id}>{d.kecamatan.nama} / {d.nama}</option>
                  ))}
                </select>
              )}
              {errors.desaKelurahanId && <p className="text-xs text-red-500 mt-1">{errors.desaKelurahanId}</p>}
            </div>

            {/* Operator & Teknologi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sf-operator" className="text-xs font-medium mb-1.5 block">Operator</Label>
                <select
                  id="sf-operator"
                  value={form.operatorId}
                  onChange={e => setField('operatorId', e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">— Pilih —</option>
                  {operatorList.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
                </select>
                {errors.operatorId && <p className="text-xs text-red-500 mt-1">{errors.operatorId}</p>}
              </div>
              <div>
                <Label htmlFor="sf-teknologi" className="text-xs font-medium mb-1.5 block">Teknologi</Label>
                <select
                  id="sf-teknologi"
                  value={form.teknologiId}
                  onChange={e => setField('teknologiId', e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">— Pilih —</option>
                  {teknologiList.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
                </select>
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

            {/* Koordinat */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-medium">Koordinat</Label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={gettingLocation}
                  className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
                >
                  {gettingLocation ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                  Gunakan Lokasi Saya
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    id="sf-lat"
                    type="number"
                    step="any"
                    placeholder="Latitude (-90 ~ 90)"
                    value={form.latitude}
                    onChange={e => setField('latitude', e.target.value)}
                    className="text-sm"
                  />
                  {errors.latitude && <p className="text-xs text-red-500 mt-1">{errors.latitude}</p>}
                </div>
                <div>
                  <Input
                    id="sf-lng"
                    type="number"
                    step="any"
                    placeholder="Longitude (-180 ~ 180)"
                    value={form.longitude}
                    onChange={e => setField('longitude', e.target.value)}
                    className="text-sm"
                  />
                  {errors.longitude && <p className="text-xs text-red-500 mt-1">{errors.longitude}</p>}
                </div>
              </div>
            </div>

            {/* Smart Warnings */}
            {distanceFromCenter != null && distanceFromCenter > 3 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
                <TriangleAlert size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <p>Lokasi pengukuran berada {distanceFromCenter.toFixed(1)} km dari pusat desa (lebih dari 3 km). Pastikan koordinat sudah sesuai dengan lokasi pengukuran sebenarnya.</p>
              </div>
            )}

            {selectedDesa && selectedDesa.latitude == null && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800">
                <MapPin size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <p>Koordinat pusat desa belum diisi. Peringatan jarak tidak dapat dihitung. Harap lengkapi koordinat desa melalui menu Demografi.</p>
              </div>
            )}

            {closestTowers.length > 0 && (
              <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <TowerControl size={13} className="text-primary" />
                  3 Tower Terdekat
                </div>
                {closestTowers.map(t => (
                  <div key={t.id} className="flex items-center justify-between pl-5">
                    <span className="text-muted-foreground truncate">{t.namaTower}</span>
                    <span className={`font-mono font-medium ${t.distance > 5 ? 'text-amber-600' : 'text-foreground'}`}>
                      {t.distance.toFixed(1)} km
                    </span>
                  </div>
                ))}
                {noTowerNearby && (
                  <p className="text-amber-700 mt-1 pl-5">Tidak ditemukan tower dalam radius 5 km dari lokasi ini. Pastikan titik koordinat sudah sesuai.</p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs font-medium mb-1.5 block">Nilai Sinyal (opsional)</Label>
              <p className="text-[10px] text-muted-foreground mb-2">Masukkan nilai sesuai tangkapan layar aplikasi pengukuran sinyal (Network Cell Info, Opensignal, dll).</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'sf-rsrp', key: 'rsrp' as const, label: 'RSRP (dBm)', placeholder: 'Contoh: -95' },
                  { id: 'sf-rssi', key: 'rssi' as const, label: 'RSSI (dBm)', placeholder: 'Contoh: -75' },
                  { id: 'sf-rsrq', key: 'rsrq' as const, label: 'RSRQ (dB)', placeholder: 'Contoh: -12' },
                  { id: 'sf-snr', key: 'snr' as const, label: 'SNR (dB)', placeholder: 'Contoh: 15' },
                ].map(({ id, key, label, placeholder }) => (
                  <div key={key}>
                    <Label htmlFor={id} className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                    <Input
                      id={id}
                      type="number"
                      step="any"
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={e => setField(key, e.target.value)}
                      className="text-sm"
                    />
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
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
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
  )
}
