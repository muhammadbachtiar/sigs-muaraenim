'use client'

import { useState } from 'react'
import { Loader2, MapPin, X, ExternalLink, Trash2, Upload, Camera } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import SignalBadge from '@/components/common/SignalBadge'
import { getSignalColor } from '@/lib/constants'
import { toast } from 'sonner'
import { useRef } from 'react'

type Foto = {
  id: string
  url: string
  keterangan: string | null
}

export type SinyalDetail = {
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
  foto: Foto[]
}

type Props = {
  open: boolean
  onClose: () => void
  data: SinyalDetail | null
  loading?: boolean
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
  onPhotoDeleted: (fotoId: string) => void
  onPhotoAdded: () => void
}

function MetricItem({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-canvas-soft)] text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-base font-bold text-foreground">
        {value !== null ? value : <span className="text-muted-foreground text-sm">—</span>}
      </div>
      {value !== null && <div className="text-xs text-muted-foreground">{unit}</div>}
    </div>
  )
}

export default function SinyalDetailDialog({
  open, onClose, data, loading, canEdit, canDelete, onEdit, onDelete, onPhotoDeleted, onPhotoAdded
}: Props) {
  const [deletingFotoId, setDeletingFotoId] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDeleteFoto = async (fotoId: string) => {
    if (!confirm('Hapus foto ini?')) return
    setDeletingFotoId(fotoId)
    try {
      const res = await fetch(`/api/foto/${fotoId}`, { method: 'DELETE' }).then(r => r.json())
      if (res.success) {
        onPhotoDeleted(fotoId)
        toast.success('Foto berhasil dihapus')
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    } finally {
      setDeletingFotoId(null)
    }
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!data) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Format tidak didukung (JPEG, PNG, WebP)')
      return
    }
    setUploadingPhoto(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('sinyal_id', data.id)
    try {
      const res = await fetch('/api/upload/sinyal', { method: 'POST', body: fd }).then(r => r.json())
      if (res.success) {
        toast.success('Foto berhasil diupload')
        onPhotoAdded()
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setUploadingPhoto(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const formatDate = (str: string) => new Date(str).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const mapsUrl = data
    ? `https://maps.google.com/?q=${data.latitude},${data.longitude}`
    : '#'

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-elevated" />
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full" onClick={() => setLightboxSrc(null)}>
            <X size={22} />
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Detail Data Sinyal</DialogTitle>
          </DialogHeader>

          {loading || !data ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 pt-1">
              {/* Header info */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm text-foreground">{data.desaKelurahan.nama}</div>
                  <div className="text-xs text-muted-foreground">{data.desaKelurahan.kecamatan.nama}</div>
                </div>
                <SignalBadge rsrp={data.rsrp} />
              </div>

              {/* Info row */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoRow label="Operator" value={data.operator.nama} />
                <InfoRow label="Teknologi" value={data.teknologi.nama} />
                <InfoRow label="Tanggal Ukur" value={formatDate(data.tanggalPengukuran)} />
                <InfoRow label="Dicatat oleh" value={data.user.nama} />
              </div>

              {/* Koordinat */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)]">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={15} className="text-[var(--color-primary)] shrink-0" />
                  <span className="font-mono text-xs">
                    {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}
                  </span>
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                >
                  <ExternalLink size={12} />
                  Maps
                </a>
              </div>

              {/* Signal metrics */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Nilai Sinyal</p>
                <div className="grid grid-cols-4 gap-2">
                  <MetricItem label="RSRP" value={data.rsrp} unit="dBm" />
                  <MetricItem label="RSSI" value={data.rssi} unit="dBm" />
                  <MetricItem label="RSRQ" value={data.rsrq} unit="dB" />
                  <MetricItem label="SNR" value={data.snr} unit="dB" />
                </div>
              </div>

              {/* RSRP visual bar */}
              {data.rsrp !== null && (
                <RSRPBar rsrp={data.rsrp} />
              )}

              {/* Catatan */}
              {data.catatan && (
                <div className="p-3 rounded-lg bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)]">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Catatan</p>
                  <p className="text-sm text-foreground">{data.catatan}</p>
                </div>
              )}

              {/* Foto */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Foto ({data.foto.length})
                  </p>
                  {(canEdit || canDelete) && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
                    >
                      {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Tambah foto
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={handleUploadPhoto}
                  />
                </div>

                {data.foto.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {data.foto.map(foto => (
                      <div key={foto.id} className="relative group rounded-lg overflow-hidden border border-[var(--color-hairline)] aspect-square">
                        <img
                          src={foto.url}
                          alt={foto.keterangan ?? 'Foto sinyal'}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxSrc(foto.url)}
                        />
                        {(canEdit || canDelete) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFoto(foto.id)}
                            disabled={deletingFotoId === foto.id}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
                          >
                            {deletingFotoId === foto.id
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Trash2 size={11} />
                            }
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--color-hairline)] p-6 text-center text-xs text-muted-foreground">
                    <Camera size={18} className="mx-auto mb-1.5 opacity-40" />
                    Belum ada foto
                  </div>
                )}
              </div>

              {/* Created at */}
              <p className="text-xs text-muted-foreground text-right">
                Dibuat: {formatDate(data.createdAt)}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-hairline)]">
                {canDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    onClick={onDelete}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Hapus
                  </Button>
                )}
                {canEdit && (
                  <Button type="button" onClick={onEdit}>
                    Edit Data
                  </Button>
                )}
                {!canEdit && !canDelete && (
                  <Button type="button" variant="outline" onClick={onClose}>Tutup</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-foreground mt-0.5">{value}</div>
    </div>
  )
}

function RSRPBar({ rsrp }: { rsrp: number }) {
  // RSRP range: -140 (worst) to -44 (best), normalize to 0-100%
  const pct = Math.max(0, Math.min(100, ((rsrp + 140) / (140 - 44)) * 100))
  const { color } = getSignalColor(rsrp)

  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Kualitas Sinyal</span>
        <span style={{ color }}>{rsrp} dBm</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>-140 dBm</span>
        <span>-44 dBm</span>
      </div>
    </div>
  )
}
