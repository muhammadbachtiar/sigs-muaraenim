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

function StatCard({ label, value, icon: Icon, color, delay }: {
  label: string; value: number | string; icon: any; color: string; delay: number
}) {
  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both border-hairline shadow-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="flex items-center justify-between p-5">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
          <div className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</div>
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

export default function DashboardPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPemdes = user?.role === 'PEMDES'

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentSinyal, setRecentSinyal] = useState<RecentSinyal[]>([])
  const [recentTower, setRecentTower] = useState<RecentTower[]>([])
  const [loading, setLoading] = useState(true)

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
          Ringkasan cakupan sinyal & infrastruktur telekomunikasi Kabupaten Muara Enim
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Titik Sinyal" value={stats?.totalSinyal ?? 0} icon={Signal} color="#0075de" delay={0} />
        <StatCard label="Total Tower" value={stats?.totalTower ?? 0} icon={TowerControl} color="#2a9d99" delay={60} />
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
                      <span className={`shrink-0 ml-3 font-mono text-xs font-medium px-2 py-0.5 rounded-full ${
                        (s.rsrp ?? -999) >= -85 ? 'bg-[#f0fdf4] text-[#16a34a]' :
                        (s.rsrp ?? -999) >= -100 ? 'bg-[#fffbeb] text-[#d97706]' :
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
              Pengajuan pembangunan tower baru disarankan melalui menu Tower.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
