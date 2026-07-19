'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Signal, TowerControl, Trash2, Upload, Clock,
  WifiOff, Wifi, TriangleAlert, Loader2, RefreshCw, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getAllDrafts, deleteDraft, clearAllDrafts, type Draft } from '@/lib/indexedDb'
import { useOnlineStore } from '@/hooks/useOnlineStatus'
import { toast } from 'sonner'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit yang lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam yang lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari yang lalu`
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DrafPage() {
  const router = useRouter()
  const isOnline = useOnlineStore((s) => s.isOnline)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getAllDrafts()
      setDrafts(all)
    } catch {
      toast.error('Gagal memuat daftar draf lokal.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadDrafts() }, [loadDrafts])

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteDraft(id)
      setDrafts((prev) => prev.filter((d) => d.id !== id))
      toast.success('Draf berhasil dihapus.')
    } catch {
      toast.error('Gagal menghapus draf.')
    }
    setDeletingId(null)
  }

  const handleClearAll = async () => {
    if (!confirm('Hapus semua draf? Tindakan ini tidak dapat dibatalkan.')) return
    try {
      await clearAllDrafts()
      setDrafts([])
      toast.success('Semua draf berhasil dihapus.')
    } catch {
      toast.error('Gagal menghapus semua draf.')
    }
  }

  const handleOpenDraft = (draft: Draft) => {
    if (draft.type === 'sinyal') {
      router.push(`/sinyal?action=create&draftId=${draft.id}`)
    } else {
      router.push(`/tower?action=create&draftId=${draft.id}`)
    }
  }

  const handleSyncAll = async () => {
    if (!isOnline) {
      toast.error('Tidak dapat mengunggah saat offline.')
      return
    }
    setSyncing(true)
    let successCount = 0
    let failCount = 0

    for (const draft of drafts) {
      try {
        const endpoint = draft.type === 'sinyal' ? '/api/sinyal' : '/api/tower'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft.data),
        }).then((r) => r.json())

        if (res.success) {
          await deleteDraft(draft.id!)
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) toast.success(`${successCount} draf berhasil diunggah.`)
    if (failCount > 0) toast.error(`${failCount} draf gagal diunggah. Periksa data dan coba lagi.`)

    await loadDrafts()
    setSyncing(false)
  }

  const sinyalDrafts = drafts.filter((d) => d.type === 'sinyal')
  const towerDrafts = drafts.filter((d) => d.type === 'tower')

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FileText size={22} className="text-purple-600" />
            Draf Tersimpan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Data yang belum diunggah ke server. Anda dapat melanjutkan pengisian atau mengunggahnya saat online.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadDrafts} className="gap-1.5 text-xs">
            <RefreshCw size={14} /> Muat Ulang
          </Button>
          {drafts.length > 0 && isOnline && (
            <Button
              size="sm"
              onClick={handleSyncAll}
              disabled={syncing}
              className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {syncing ? 'Mengunggah...' : 'Unggah Semua'}
            </Button>
          )}
          {drafts.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="gap-1.5 text-xs text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Hapus Semua
            </Button>
          )}
        </div>
      </div>

      {/* Status Koneksi */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium ${
        isOnline
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
        {isOnline
          ? 'Anda sedang online. Draf dapat diunggah ke server.'
          : 'Anda sedang offline. Draf baru akan disimpan secara lokal.'}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && drafts.length === 0 && (
        <Card className="border-hairline shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">Tidak ada draf tersimpan</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Semua data Anda sudah diunggah. Draf baru akan muncul di sini ketika Anda menyimpan
              form tanpa mengunggahnya.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Draf Sinyal */}
      {sinyalDrafts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Signal size={13} className="text-blue-500" />
            Pencatatan Sinyal ({sinyalDrafts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sinyalDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                icon={<Signal size={16} className="text-blue-600" />}
                accentColor="blue"
                onOpen={() => handleOpenDraft(draft)}
                onDelete={() => handleDelete(draft.id!)}
                deleting={deletingId === draft.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Draf Tower */}
      {towerDrafts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TowerControl size={13} className="text-teal-500" />
            Pengajuan Tower ({towerDrafts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {towerDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                icon={<TowerControl size={16} className="text-teal-600" />}
                accentColor="teal"
                onOpen={() => handleOpenDraft(draft)}
                onDelete={() => handleDelete(draft.id!)}
                deleting={deletingId === draft.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Draft Card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  icon,
  accentColor,
  onOpen,
  onDelete,
  deleting,
}: {
  draft: Draft
  icon: React.ReactNode
  accentColor: string
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <Card
      className="border-hairline shadow-soft hover:shadow-elevated transition-shadow cursor-pointer group"
      onClick={onOpen}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-${accentColor}-50 flex items-center justify-center shrink-0`}
              style={{ backgroundColor: accentColor === 'blue' ? '#eff6ff' : '#f0fdfa' }}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {draft.type === 'sinyal' ? 'Pencatatan Sinyal' : 'Pengajuan Tower'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{draft.label || 'Data belum lengkap'}</p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Hapus draf"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>

        {/* Info badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
            <Clock size={10} /> {timeAgo(draft.createdAt)}
          </span>
          {draft.wasOffline && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-200">
              <WifiOff size={10} /> Offline
            </span>
          )}
        </div>

        {/* Detail info dari data */}
        {draft.data && (
          <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-[var(--color-hairline)] pt-2">
            {draft.type === 'sinyal' && (
              <>
                {draft.data.latitude && draft.data.longitude && (
                  <p className="font-mono text-[10px]">📍 {Number(draft.data.latitude).toFixed(5)}, {Number(draft.data.longitude).toFixed(5)}</p>
                )}
                {draft.data.rsrp != null && <p>RSRP: <strong>{draft.data.rsrp} dBm</strong></p>}
              </>
            )}
            {draft.type === 'tower' && (
              <>
                {draft.data.namaTower && <p>🗼 {draft.data.namaTower}</p>}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
