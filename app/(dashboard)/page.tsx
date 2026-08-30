'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Signal,
  TowerControl,
  BarChart3,
  Database,
  ArrowRight,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TriangleAlert,
  MapPin,
  Map,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import dynamic from 'next/dynamic'

const DashboardMap = dynamic(() => import('@/components/map/DashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] flex items-center justify-center text-xs text-muted-foreground">
      <Loader2 size={18} className="animate-spin mr-2" /> Memuat Peta Sebaran...
    </div>
  ),
})

type KecamatanBreakdown = {
  id: string
  nama: string
  jumlahDesa: number
  sinyal: { total: number; baik: number; sedang: number; buruk: number }
  tower: { total: number; approved: number; pending: number; rejected: number }
}

type DashboardStats = {
  totalSinyal: number
  sinyalBaik: number
  sinyalSedang: number
  sinyalBuruk: number
  totalTower: number
  towerApproved: number
  towerPending: number
  towerRejected: number
  totalOperator: number
  totalTeknologi: number
  totalDesa: number
  towersNearby?: number
  desaLatitude?: number | null
  desaLongitude?: number | null
  demografiFields?: {
    jumlahPenduduk: number | null
    usiaProduktif: number | null
    kepadatan: number | null
    rataRataPenghasilan: number | null
    mataPencaharianUtama: string | null
  }
  byKecamatan?: KecamatanBreakdown[]
}

type RecentSinyal = {
  id: number
  rsrp: number | null
  createdAt: string
  operator: { nama: string }
  desaKelurahan: { nama: string }
  user: { nama: string }
}

type RecentTower = {
  id: number
  namaTower: string
  statusVerifikasi: string
  createdAt: string
  kecamatan: { nama: string }
  user: { nama: string }
}

// ─── StatCard with optional click ──────────────────────────────────
function StatCard({ label, value, icon: Icon, color, delay, onClick, clickable }: {
  label: string; value: number | string; icon: any; color: string; delay: number
  onClick?: () => void; clickable?: boolean
}) {
  return (
    <Card
      className={`animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both border-hairline shadow-soft transition-all ${
        clickable ? 'cursor-pointer hover:shadow-elevated hover:scale-[1.02] hover:border-[var(--color-primary)]/40 active:scale-[0.98]' : ''
      }`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={clickable ? onClick : undefined}
    >
      <CardContent className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
          <div className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</div>
          {clickable && (
            <p className="text-[10px] text-[var(--color-primary)] font-medium mt-1.5 flex items-center gap-0.5">
              Lihat sebaran <ArrowRight size={10} />
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ml-3"
          style={{ backgroundColor: `${color}14` }}
        >
          <Icon size={20} color={color} />
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; icon: any }> = {
    APPROVED: { bg: '#f0fdf4', text: '#16a34a', icon: CheckCircle2 },
    PENDING: { bg: '#fffbeb', text: '#d97706', icon: Clock },
    REJECTED: { bg: '#fef2f2', text: '#dc2626', icon: AlertCircle },
  }
  const s = map[status] || map.PENDING
  const Icon = s.icon
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      <Icon size={12} /> {status}
    </span>
  )
}

// ─── Shared Bar Component ──────────────────────────────────────────
function PercentBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="w-full h-2 bg-[var(--color-canvas-soft)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Sinyal Breakdown Modal ────────────────────────────────────────
function SinyalBreakdownModal({
  open, onClose, stats, isPemdes,
}: {
  open: boolean; onClose: () => void; stats: DashboardStats; isPemdes: boolean
}) {
  const [sortKey, setSortKey] = useState<'total' | 'baik' | 'sedang' | 'buruk'>('total')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  if (!open) return null

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: typeof sortKey }) => {
    if (sortKey !== field) return <ChevronDown size={12} className="text-muted-foreground/40" />
    return sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
  }

  // Sorted kecamatan data
  const kecData = [...(stats.byKecamatan || [])].sort((a, b) => {
    const va = a.sinyal[sortKey]
    const vb = b.sinyal[sortKey]
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const maxSinyal = Math.max(...kecData.map(k => k.sinyal.total), 1)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-elevated border border-[var(--color-hairline)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-hairline)] bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Signal size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Sebaran Data Sinyal</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPemdes ? 'Rincian kualitas sinyal di desa Anda' : `Distribusi ${stats.totalSinyal.toLocaleString('id-ID')} titik sinyal per kecamatan`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="px-6 py-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface)]">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: stats.totalSinyal, color: '#0075de' },
              { label: 'Baik (> -85)', value: stats.sinyalBaik, color: '#22c55e' },
              { label: 'Sedang', value: stats.sinyalSedang, color: '#eab308' },
              { label: 'Buruk (< -99)', value: stats.sinyalBuruk, color: '#ef4444' },
            ].map(p => (
              <div key={p.label} className="text-center py-2 px-1 rounded-lg bg-[var(--color-canvas-soft)]">
                <div className="text-lg font-bold font-mono" style={{ color: p.color }}>{p.value.toLocaleString('id-ID')}</div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isPemdes ? (
            /* PEMDES: quality breakdown donut-style */
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Distribusi kualitas sinyal di desa Anda:</p>
              {[
                { label: 'Sinyal Baik (> -85 dBm)', value: stats.sinyalBaik, color: '#22c55e' },
                { label: 'Sinyal Sedang (-85 s/d -99 dBm)', value: stats.sinyalSedang, color: '#eab308' },
                { label: 'Sinyal Buruk (< -99 dBm)', value: stats.sinyalBuruk, color: '#ef4444' },
              ].map(q => {
                const pct = stats.totalSinyal > 0 ? ((q.value / stats.totalSinyal) * 100).toFixed(1) : '0'
                return (
                  <div key={q.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                        <span className="font-medium text-foreground">{q.label}</span>
                      </div>
                      <span className="font-mono text-sm font-bold" style={{ color: q.color }}>
                        {q.value} <span className="text-muted-foreground text-xs font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <PercentBar value={q.value} max={stats.totalSinyal} color={q.color} />
                  </div>
                )
              })}
              {stats.totalSinyal === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Signal size={28} className="mx-auto mb-2 opacity-30" />
                  Belum ada data sinyal di desa Anda.
                </div>
              )}
            </div>
          ) : (
            /* SUPER_ADMIN: per-kecamatan table */
            <div className="space-y-3">
              {/* Sortable header */}
              <div className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 text-[10px] text-muted-foreground uppercase font-semibold tracking-wider px-1">
                <span>Kecamatan</span>
                <button onClick={() => handleSort('total')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  Total <SortIcon field="total" />
                </button>
                <button onClick={() => handleSort('baik')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  Baik <SortIcon field="baik" />
                </button>
                <button onClick={() => handleSort('sedang')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  Sedang <SortIcon field="sedang" />
                </button>
                <button onClick={() => handleSort('buruk')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  Buruk <SortIcon field="buruk" />
                </button>
              </div>

              {/* Rows */}
              {kecData.map((k, i) => {
                const pct = stats.totalSinyal > 0 ? ((k.sinyal.total / stats.totalSinyal) * 100).toFixed(1) : '0'
                return (
                  <div
                    key={k.id}
                    className="grid grid-cols-[1fr_60px_60px_60px_60px] gap-2 items-center py-2.5 px-3 rounded-xl bg-[var(--color-canvas-soft)] hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-hairline)] transition-all"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground/60 w-5 text-right shrink-0">{i + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{k.nama}</p>
                          <p className="text-[10px] text-muted-foreground">{k.jumlahDesa} desa · {pct}%</p>
                        </div>
                      </div>
                      <div className="mt-1.5 ml-7">
                        <PercentBar value={k.sinyal.total} max={maxSinyal} color="#0075de" />
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold font-mono text-foreground">{k.sinyal.total}</div>
                    <div className="text-right text-sm font-mono text-[#22c55e] font-medium">{k.sinyal.baik}</div>
                    <div className="text-right text-sm font-mono text-[#eab308] font-medium">{k.sinyal.sedang}</div>
                    <div className="text-right text-sm font-mono text-[#ef4444] font-medium">{k.sinyal.buruk}</div>
                  </div>
                )
              })}

              {kecData.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Signal size={28} className="mx-auto mb-2 opacity-30" />
                  Data breakdown per kecamatan tidak tersedia.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tower Breakdown Modal ─────────────────────────────────────────
function TowerBreakdownModal({
  open, onClose, stats, isPemdes,
}: {
  open: boolean; onClose: () => void; stats: DashboardStats; isPemdes: boolean
}) {
  const [sortKey, setSortKey] = useState<'total' | 'approved' | 'pending' | 'rejected'>('total')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  if (!open) return null

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: typeof sortKey }) => {
    if (sortKey !== field) return <ChevronDown size={12} className="text-muted-foreground/40" />
    return sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />
  }

  const kecData = [...(stats.byKecamatan || [])].sort((a, b) => {
    const va = a.tower[sortKey]
    const vb = b.tower[sortKey]
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const maxTower = Math.max(...kecData.map(k => k.tower.total), 1)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-elevated border border-[var(--color-hairline)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-hairline)] bg-gradient-to-r from-teal-50 to-teal-100/50 dark:from-teal-950/30 dark:to-teal-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
              <TowerControl size={20} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Sebaran Data Tower</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPemdes
                  ? `Tower aktif dalam radius 5 km dari pusat desa Anda`
                  : `Distribusi ${stats.totalTower.toLocaleString('id-ID')} tower per kecamatan`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="px-6 py-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface)]">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: stats.totalTower, color: '#2a9d99' },
              { label: 'Approved', value: stats.towerApproved, color: '#16a34a' },
              { label: 'Pending', value: stats.towerPending, color: '#d97706' },
              { label: 'Rejected', value: stats.towerRejected, color: '#dc2626' },
            ].map(p => (
              <div key={p.label} className="text-center py-2 px-1 rounded-lg bg-[var(--color-canvas-soft)]">
                <div className="text-lg font-bold font-mono" style={{ color: p.color }}>{p.value.toLocaleString('id-ID')}</div>
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isPemdes ? (
            /* PEMDES: nearby tower info */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-canvas-soft)] border border-[var(--color-hairline)]">
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                  <TowerControl size={24} className="text-teal-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stats.towersNearby ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Tower aktif dalam radius 5 km dari pusat desa Anda</div>
                </div>
              </div>
              {(stats.towersNearby ?? 0) === 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
                  <TriangleAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p>Tidak ada tower terdeteksi dalam radius 5 km. Ajukan penambahan tower melalui menu Tower untuk meningkatkan jangkauan sinyal di desa Anda.</p>
                </div>
              )}
              {stats.desaLatitude == null && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-blue-200 bg-blue-50 text-xs text-blue-800">
                  <MapPin size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>Koordinat pusat desa belum diisi. Lengkapi di menu Demografi agar deteksi tower terdekat aktif.</p>
                </div>
              )}
            </div>
          ) : (
            /* SUPER_ADMIN: per-kecamatan table */
            <div className="space-y-3">
              {/* Sortable header */}
              <div className="grid grid-cols-[1fr_55px_55px_55px_55px] gap-2 text-[10px] text-muted-foreground uppercase font-semibold tracking-wider px-1">
                <span>Kecamatan</span>
                <button onClick={() => handleSort('total')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  Total <SortIcon field="total" />
                </button>
                <button onClick={() => handleSort('approved')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  <CheckCircle2 size={10} className="text-green-500" /> <SortIcon field="approved" />
                </button>
                <button onClick={() => handleSort('pending')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  <Clock size={10} className="text-amber-500" /> <SortIcon field="pending" />
                </button>
                <button onClick={() => handleSort('rejected')} className="flex items-center gap-0.5 justify-end hover:text-foreground transition-colors">
                  <AlertCircle size={10} className="text-red-500" /> <SortIcon field="rejected" />
                </button>
              </div>

              {/* Rows */}
              {kecData.map((k, i) => {
                const pct = stats.totalTower > 0 ? ((k.tower.total / stats.totalTower) * 100).toFixed(1) : '0'
                return (
                  <div
                    key={k.id}
                    className="grid grid-cols-[1fr_55px_55px_55px_55px] gap-2 items-center py-2.5 px-3 rounded-xl bg-[var(--color-canvas-soft)] hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-hairline)] transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground/60 w-5 text-right shrink-0">{i + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{k.nama}</p>
                          <p className="text-[10px] text-muted-foreground">{k.jumlahDesa} desa · {pct}%</p>
                        </div>
                      </div>
                      <div className="mt-1.5 ml-7">
                        <PercentBar value={k.tower.total} max={maxTower} color="#2a9d99" />
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold font-mono text-foreground">{k.tower.total}</div>
                    <div className="text-right text-sm font-mono text-[#16a34a] font-medium">{k.tower.approved}</div>
                    <div className="text-right text-sm font-mono text-[#d97706] font-medium">{k.tower.pending}</div>
                    <div className="text-right text-sm font-mono text-[#dc2626] font-medium">{k.tower.rejected}</div>
                  </div>
                )
              })}

              {kecData.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <TowerControl size={28} className="mx-auto mb-2 opacity-30" />
                  Data breakdown per kecamatan tidak tersedia.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPemdes = user?.role === 'PEMDES'

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentSinyal, setRecentSinyal] = useState<RecentSinyal[]>([])
  const [recentTower, setRecentTower] = useState<RecentTower[]>([])
  const [loading, setLoading] = useState(true)
  const [sinyalModalOpen, setSinyalModalOpen] = useState(false)
  const [towerModalOpen, setTowerModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/dashboard/sinyal-statistik').then(r => r.json()),
        fetch('/api/dashboard/recent-activity').then(r => r.json()),
      ])
      if (statsRes.success) setStats(statsRes.data)
      if (activityRes.success) {
        setRecentSinyal(activityRes.data.recentSinyal || [])
        setRecentTower(activityRes.data.recentTower || [])
      }
    } catch { /* silently fail */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ringkasan cakupan sinyal &amp; infrastruktur telekomunikasi Kabupaten Muara Enim
        </p>
      </div>

      {/* Shortcut Grid ala MyBCA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Input Sinyal', icon: Signal, href: '/sinyal?action=create', color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Ajukan Tower', icon: TowerControl, href: '/tower?action=create', color: '#14b8a6', bg: '#f0fdfa' },
          { label: 'Daftar Draf', icon: FileText, href: '/draf', color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Peta Publik', icon: Map, href: '/peta', color: '#8b5cf6', bg: '#f5f3ff' },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] hover:shadow-elevated transition-all group"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: s.bg }}
              >
                <Icon size={18} color={s.color} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">Buka menu</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Stats Grid — Total Sinyal & Total Tower are clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Titik Sinyal"
          value={stats?.totalSinyal ?? 0}
          icon={Signal}
          color="#0075de"
          delay={0}
          clickable
          onClick={() => setSinyalModalOpen(true)}
        />
        <StatCard
          label="Total Tower"
          value={stats?.totalTower ?? 0}
          icon={TowerControl}
          color="#2a9d99"
          delay={60}
          clickable
          onClick={() => setTowerModalOpen(true)}
        />
        <StatCard label="Sinyal Baik" value={stats?.sinyalBaik ?? 0} icon={BarChart3} color="#22c55e" delay={120} />
        <StatCard label="Sinyal Sedang" value={stats?.sinyalSedang ?? 0} icon={BarChart3} color="#eab308" delay={180} />
        <StatCard label="Sinyal Buruk" value={stats?.sinyalBuruk ?? 0} icon={BarChart3} color="#ef4444" delay={240} />
      </div>

      {/* Pemdes: Completeness Card & Warnings */}
      {isPemdes && stats && <DesaCompletenessCard stats={stats} />}

      {/* Interactive Map Section */}
      <DashboardMap />

      {/* Two-column cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Master Data Summary */}
        <Card className="border-hairline shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '300ms' }}>
          <CardHeader className="border-b border-hairline p-5 pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database size={16} className="text-primary" />
              Ringkasan Master Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Operator', value: stats?.totalOperator ?? 0 },
                { label: 'Teknologi', value: stats?.totalTeknologi ?? 0 },
                { label: 'Desa', value: stats?.totalDesa ?? 0 },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 bg-[var(--color-canvas-soft)] rounded-lg">
                  <div className="text-lg font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-[#f0fdf4] rounded-lg">
                <div className="text-lg font-bold text-[#16a34a]">{stats?.towerApproved ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Approved</div>
              </div>
              <div className="text-center p-3 bg-[#fffbeb] rounded-lg">
                <div className="text-lg font-bold text-[#d97706]">{stats?.towerPending ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
              </div>
              <div className="text-center p-3 bg-[#fef2f2] rounded-lg">
                <div className="text-lg font-bold text-[#dc2626]">{stats?.towerRejected ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Rejected</div>
              </div>
            </div>
            <Link href="/master" className={buttonVariants({ variant: "outline", className: "w-full flex items-center justify-center gap-2" })}>
              Kelola Master Data <ArrowRight size={16} />
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-hairline shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: '360ms' }}>
          <CardHeader className="border-b border-hairline p-5 pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity size={16} className="text-[#2a9d99]" />
              Aktivitas Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Recent signals */}
            {recentSinyal.length > 0 && (
              <div className="p-5 pb-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sinyal Terbaru</p>
                <div className="space-y-2.5">
                  {recentSinyal.slice(0, 4).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm py-1.5">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{s.operator.nama}</span>
                        <span className="text-muted-foreground"> — {s.desaKelurahan.nama}</span>
                      </div>
                      <span className={`shrink-0 ml-3 font-mono text-xs font-medium px-2 py-0.5 rounded-full ${(s.rsrp ?? -999) > -85 ? 'bg-[#f0fdf4] text-[#16a34a]' :
                          (s.rsrp ?? -999) >= -99 ? 'bg-[#fffbeb] text-[#d97706]' :
                            'bg-[#fef2f2] text-[#dc2626]'
                        }`}>
                        {s.rsrp ?? '—'} dBm
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent towers */}
            {recentTower.length > 0 && (
              <div className="p-5 border-t border-hairline">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tower Terbaru</p>
                <div className="space-y-2.5">
                  {recentTower.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm py-1.5">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-foreground">{t.namaTower}</span>
                        <span className="text-muted-foreground"> — {t.kecamatan.nama}</span>
                      </div>
                      <span className="shrink-0 ml-3">{statusBadge(t.statusVerifikasi)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentSinyal.length === 0 && recentTower.length === 0 && (
              <div className="p-5 text-center text-sm text-muted-foreground">Belum ada aktivitas</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Modals */}
      {stats && (
        <>
          <SinyalBreakdownModal
            open={sinyalModalOpen}
            onClose={() => setSinyalModalOpen(false)}
            stats={stats}
            isPemdes={isPemdes}
          />
          <TowerBreakdownModal
            open={towerModalOpen}
            onClose={() => setTowerModalOpen(false)}
            stats={stats}
            isPemdes={isPemdes}
          />
        </>
      )}
    </div>
  )
}

function DesaCompletenessCard({ stats }: { stats: DashboardStats }) {
  const hasTikor = stats.desaLatitude != null && stats.desaLongitude != null
  const fields: Record<string, any> = stats.demografiFields || {}

  let score = 0
  if (hasTikor) score += 30

  const demoFields = ['jumlahPenduduk', 'usiaProduktif', 'kepadatan', 'rataRataPenghasilan', 'mataPencaharianUtama'] as const
  const filledCount = demoFields.filter(f => fields[f] != null && fields[f] !== '').length
  score += filledCount * 8

  if (stats.totalSinyal > 0) score += 15
  if ((stats.towersNearby ?? 0) > 0) score += 15

  let statusMessage = ''
  let statusColor = ''
  if (score < 50) {
    statusMessage = 'Status data desa kurang lengkap. Harap melengkapi koordinat pusat desa dan metrik demografi untuk memastikan keakuratan analisis kewilayahan.'
    statusColor = 'text-amber-700'
  } else if (score < 85) {
    statusMessage = 'Status data desa cukup lengkap. Melengkapi sisa data yang kosong disarankan untuk hasil analisis yang optimal.'
    statusColor = 'text-blue-700'
  } else {
    statusMessage = 'Status data desa lengkap. Seluruh data utama telah terisi dan siap digunakan untuk analisis sistem.'
    statusColor = 'text-green-700'
  }

  return (
    <Card className="border-hairline shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      <CardHeader className="border-b border-hairline p-5 pb-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          Kelengkapan Profil Desa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Kelengkapan Data</span>
            <span className="font-bold text-foreground">{score}%</span>
          </div>
          <div className="w-full h-2.5 bg-[var(--color-canvas-soft)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${score}%`,
                backgroundColor: score < 50 ? '#f59e0b' : score < 85 ? '#3b82f6' : '#22c55e',
              }}
            />
          </div>
          <p className={`text-xs ${statusColor}`}>{statusMessage}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className={`p-2.5 rounded-lg border ${hasTikor ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={12} className={hasTikor ? 'text-green-600' : 'text-amber-600'} />
              <span className="font-semibold">Koordinat</span>
            </div>
            <span className={hasTikor ? 'text-green-700' : 'text-amber-700'}>{hasTikor ? 'Terisi' : 'Belum diisi'}</span>
          </div>
          <div className={`p-2.5 rounded-lg border ${filledCount === 5 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Database size={12} className={filledCount === 5 ? 'text-green-600' : 'text-amber-600'} />
              <span className="font-semibold">Demografi</span>
            </div>
            <span className={filledCount === 5 ? 'text-green-700' : 'text-amber-700'}>{filledCount}/5 terisi</span>
          </div>
          <div className={`p-2.5 rounded-lg border ${stats.totalSinyal > 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Signal size={12} className={stats.totalSinyal > 0 ? 'text-green-600' : 'text-amber-600'} />
              <span className="font-semibold">Sinyal</span>
            </div>
            <span className={stats.totalSinyal > 0 ? 'text-green-700' : 'text-amber-700'}>{stats.totalSinyal > 0 ? `${stats.totalSinyal} titik` : 'Belum ada'}</span>
          </div>
          <div className={`p-2.5 rounded-lg border ${(stats.towersNearby ?? 0) > 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <TowerControl size={12} className={(stats.towersNearby ?? 0) > 0 ? 'text-green-600' : 'text-amber-600'} />
              <span className="font-semibold">Tower</span>
            </div>
            <span className={(stats.towersNearby ?? 0) > 0 ? 'text-green-700' : 'text-amber-700'}>
              {(stats.towersNearby ?? 0) > 0 ? `${stats.towersNearby} terdekat` : 'Tidak ada'}
            </span>
          </div>
        </div>

        {!hasTikor && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-300 bg-amber-50">
            <TriangleAlert size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Koordinat pusat desa belum diisi. Harap lengkapi melalui menu Demografi untuk mengaktifkan
              perhitungan jarak sinyal dan deteksi tower terdekat.
            </p>
          </div>
        )}

        {hasTikor && (stats.towersNearby ?? 0) === 0 && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-blue-200 bg-blue-50">
            <TowerControl size={15} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Belum terdeteksi tower telekomunikasi aktif dalam radius 5 km dari pusat desa.
              Tambahkan data tower terdekat di daerah Anda.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
