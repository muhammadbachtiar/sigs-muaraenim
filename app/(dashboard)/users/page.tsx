'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Users, UserPlus, Search, MapPin, Pencil, Key, Check, X,
  ChevronLeft, ChevronRight, Power, Loader2,
  UserCheck, UserX, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type UserItem = {
  id: string
  username: string
  nama: string
  role: 'PEMDES' | 'SUPER_ADMIN'
  isActive: boolean
  createdAt: string
  desaKelurahan: {
    id: string
    nama: string
    kecamatan: {
      id: string
      nama: string
    }
  } | null
}

type KecamatanItem = {
  id: string
  nama: string
  kode: string
}

type DesaItem = {
  id: string
  nama: string
  kecamatanId: string
}

export default function UserManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const user = session?.user as any
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalActive, setTotalActive] = useState(0)
  const [totalInactive, setTotalInactive] = useState(0)
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Master options for dropdowns
  const [allKecamatans, setAllKecamatans] = useState<KecamatanItem[]>([])
  const [allDesas, setAllDesas] = useState<DesaItem[]>([])
  const [desasLoading, setDesasLoading] = useState(false)

  // Modal control
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showToggleModal, setShowToggleModal] = useState(false)

  // Active target for edit/reset/toggle
  const [activeUser, setActiveUser] = useState<UserItem | null>(null)

  // Form Fields
  const [usernameVal, setUsernameVal] = useState('')
  const [namaVal, setNamaVal] = useState('')
  const [passwordVal, setPasswordVal] = useState('')
  const [selectedKecId, setSelectedKecId] = useState('')
  const [selectedDesaId, setSelectedDesaId] = useState('')
  const [isActiveVal, setIsActiveVal] = useState(true)

  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redirect if not Super Admin
  useEffect(() => {
    if (status === 'authenticated' && !isSuperAdmin) {
      toast.error('Anda tidak memiliki izin untuk mengakses halaman ini.')
      router.push('/')
    }
  }, [status, isSuperAdmin, router])

  // --- FETCH MASTER DATA ---
  useEffect(() => {
    if (status === 'authenticated' && isSuperAdmin) {
      // Fetch Kecamatan using is_select=true to bypass pagination/limits
      fetch('/api/master/kecamatan?is_select=true')
        .then(r => r.json())
        .then(res => {
          if (res.success) setAllKecamatans(res.data)
        })
        .catch(err => console.error('Failed to load kecamatan', err))
    }
  }, [status, isSuperAdmin])

  // Fetch Desas dynamically for select inputs
  const fetchDesasForKecamatan = useCallback(async (kecId: string) => {
    if (!kecId) {
      setAllDesas([])
      return
    }
    setDesasLoading(true)
    try {
      const res = await fetch(`/api/master/desa?is_select=true&kecamatan_id=${kecId}`).then(r => r.json())
      if (res.success) {
        setAllDesas(res.data)
      } else {
        toast.error(res.message || 'Gagal memuat daftar desa')
      }
    } catch (err) {
      console.error('Failed to load desa', err)
      toast.error('Gagal memuat daftar desa')
    } finally {
      setDesasLoading(false)
    }
  }, [])

  // --- FETCH USERS ---
  const fetchUsers = useCallback(async (query: string, pageNum: number, filter: typeof statusFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        page_size: '10'
      })
      if (query) params.set('search', query)

      const res = await fetch(`/api/admin/users?${params}`).then(r => r.json())
      if (res.success) {
        // Filter client-side for active/inactive since backend defaults to returning active/inactive together
        let filtered = res.data as UserItem[]
        if (filter === 'ACTIVE') {
          filtered = filtered.filter(u => u.isActive)
        } else if (filter === 'INACTIVE') {
          filtered = filtered.filter(u => !u.isActive)
        }

        setUsersList(filtered)
        setTotalUsers(res.meta.total)
        setTotalActive(res.meta.totalActive ?? 0)
        setTotalInactive(res.meta.totalInactive ?? 0)
        setTotalPages(res.meta.total_pages)
      } else {
        toast.error(res.message || 'Gagal memuat daftar user')
      }
    } catch {
      toast.error('Kesalahan jaringan saat memuat user')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && isSuperAdmin) {
      fetchUsers(searchQuery, page, statusFilter)
    }
  }, [status, isSuperAdmin, page, statusFilter, fetchUsers])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetchUsers(val, 1, statusFilter)
    }, 350)
  }

  // --- FORM HELPERS ---
  const resetForm = () => {
    setUsernameVal('')
    setNamaVal('')
    setPasswordVal('')
    setSelectedKecId('')
    setSelectedDesaId('')
    setIsActiveVal(true)
    setFormError('')
  }

  // Filter desas depending on selected Kecamatan
  const filteredDesas = allDesas.filter(d => d.kecamatanId === selectedKecId)

  // --- ACTION HANDLERS ---
  const handleAddSubmit = async () => {
    if (!usernameVal.trim()) return setFormError('Username wajib diisi')
    if (!namaVal.trim()) return setFormError('Nama Admin wajib diisi')
    if (!passwordVal || passwordVal.length < 6) return setFormError('Password minimal 6 karakter')
    if (!selectedDesaId) return setFormError('Desa tugas wajib dipilih')

    setFormError('')
    setSubmitting(true)

    const payload = {
      username: usernameVal.trim().toLowerCase().replace(/\s+/g, ''),
      nama: namaVal.trim(),
      password: passwordVal,
      desaKelurahanId: selectedDesaId,
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        toast.success(res.message || 'User Pemdes berhasil dibuat')
        setShowAddModal(false)
        resetForm()
        fetchUsers(searchQuery, page, statusFilter)
      } else {
        setFormError(res.message)
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!activeUser) return
    if (!namaVal.trim()) return setFormError('Nama Admin wajib diisi')
    if (!selectedDesaId) return setFormError('Desa tugas wajib dipilih')

    setFormError('')
    setSubmitting(true)

    const payload = {
      nama: namaVal.trim(),
      desaKelurahanId: selectedDesaId,
      isActive: isActiveVal,
    }

    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        toast.success(res.message || 'Akun user berhasil diperbarui')
        setShowEditModal(false)
        setActiveUser(null)
        resetForm()
        fetchUsers(searchQuery, page, statusFilter)
      } else {
        setFormError(res.message)
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!activeUser) return
    if (!passwordVal || passwordVal.length < 6) return setFormError('Password minimal 6 karakter')

    setFormError('')
    setSubmitting(true)

    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordVal }),
      }).then(r => r.json())

      if (res.success) {
        toast.success('Password berhasil di-reset')
        setShowResetModal(false)
        setActiveUser(null)
        resetForm()
      } else {
        setFormError(res.message)
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!activeUser) return
    setSubmitting(true)

    const targetStatus = !activeUser.isActive

    try {
      const res = await fetch(`/api/admin/users/${activeUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: targetStatus }),
      }).then(r => r.json())

      if (res.success) {
        toast.success(`User berhasil ${targetStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
        setShowToggleModal(false)
        setActiveUser(null)
        fetchUsers(searchQuery, page, statusFilter)
      } else {
        toast.error(res.message || 'Gagal mengubah status user')
      }
    } catch {
      toast.error('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = async (item: UserItem) => {
    setActiveUser(item)
    setNamaVal(item.nama)
    setIsActiveVal(item.isActive)
    setFormError('')
    if (item.desaKelurahan) {
      const kecId = item.desaKelurahan.kecamatan?.id || ''
      setSelectedKecId(kecId)
      setSelectedDesaId(item.desaKelurahan.id)
      await fetchDesasForKecamatan(kecId)
    } else {
      setSelectedKecId('')
      setSelectedDesaId('')
      setAllDesas([])
    }
    setShowEditModal(true)
  }

  const openResetModal = (item: UserItem) => {
    setActiveUser(item)
    setPasswordVal('')
    setFormError('')
    setShowResetModal(true)
  }

  const openToggleModal = (item: UserItem) => {
    setActiveUser(item)
    setShowToggleModal(true)
  }

  // --- STATS HELPER ---
  const activeCount = usersList.filter(u => u.isActive).length
  const inactiveCount = usersList.filter(u => !u.isActive).length

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-hairline border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'authenticated' && !isSuperAdmin) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Manajemen User</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola akun petugas Pemerintah Desa (PEMDES) di Kabupaten Muara Enim.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddModal(true) }} className="h-9 shadow-soft">
          <UserPlus size={16} className="mr-1.5" />
          Tambah User Pemdes
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-hairline shadow-soft bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total User Pemdes</p>
              <div className="text-3xl font-bold font-mono mt-1 text-foreground">{totalUsers}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-soft bg-gradient-to-br from-success/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">User Aktif</p>
              <div className="text-3xl font-bold font-mono mt-1 text-success">
                {totalActive}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
              <UserCheck size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-hairline shadow-soft bg-gradient-to-br from-destructive/5 via-transparent to-transparent">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">User Nonaktif</p>
              <div className="text-3xl font-bold font-mono mt-1 text-destructive">
                {totalInactive}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <UserX size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari username atau nama admin..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="flex border border-hairline rounded-lg p-0.5 bg-[var(--color-surface)] shadow-xs">
          {[
            { value: 'ALL', label: 'Semua Status' },
            { value: 'ACTIVE', label: 'Aktif' },
            { value: 'INACTIVE', label: 'Nonaktif' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value as any); setPage(1) }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${statusFilter === opt.value
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-hairline rounded-xl overflow-hidden bg-[var(--color-surface)]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : usersList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Users size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">User Pemdes tidak ditemukan</p>
            <p className="text-xs mt-1">Gunakan kata kunci pencarian lain atau buat user baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-[var(--color-canvas-soft)]">
                  <TableHead className="w-[56px] pl-4 text-xs font-semibold uppercase">No</TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold uppercase">Username</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Nama Admin</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Wilayah Tugas</TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase">Status</TableHead>
                  <TableHead className="w-[160px] text-xs font-semibold uppercase">Dibuat Pada</TableHead>
                  <TableHead className="w-[160px] text-right pr-4 text-xs font-semibold uppercase">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.map((item, index) => {
                  const rowNum = (page - 1) * 10 + index + 1
                  return (
                    <TableRow key={item.id} className="transition-colors hover:bg-[var(--color-canvas-soft)]/50">
                      <TableCell className="text-muted-foreground font-mono text-sm pl-4">{rowNum}</TableCell>
                      <TableCell className="font-mono text-sm text-foreground font-semibold">{item.username}</TableCell>
                      <TableCell className="text-sm font-medium text-foreground">{item.nama}</TableCell>
                      <TableCell className="text-sm">
                        {item.desaKelurahan ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">{item.desaKelurahan.nama}</span>
                            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-primary/10 text-primary">
                              Kec. {item.desaKelurahan.kecamatan?.nama || '-'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Belum diatur</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${item.isActive
                          ? 'bg-success-light text-success'
                          : 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                          }`}>
                          {item.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Reset Password"
                            onClick={() => openResetModal(item)}
                          >
                            <Key size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Edit Akun"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${item.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-success hover:bg-success/10'}`}
                            title={item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            onClick={() => openToggleModal(item)}
                          >
                            <Power size={14} />
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
            Menampilkan {(page - 1) * 10 + 1}–{Math.min(page * 10, totalUsers)} dari {totalUsers}
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

      {/* ==========================================
          ─── MODAL: TAMBAH USER PEMDES ───
          ========================================== */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Tambah Akun Pemdes</DialogTitle>
            <DialogDescription>
              Buat akun operator baru untuk melakukan manajemen data di tingkat Desa/Kelurahan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="add-username">Username <span className="text-destructive">*</span></Label>
              <Input
                id="add-username"
                placeholder="Contoh: pagardewa_3"
                value={usernameVal}
                onChange={(e) => setUsernameVal(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                className={formError && !usernameVal.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              <span className="text-[10px] text-muted-foreground">Otomatis diubah ke huruf kecil tanpa spasi.</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-nama">Nama Admin/Petugas <span className="text-destructive">*</span></Label>
              <Input
                id="add-nama"
                placeholder="Contoh: Admin Desa Pagar Dewa"
                value={namaVal}
                onChange={(e) => setNamaVal(e.target.value)}
                className={formError && !namaVal.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-password">Password Baru <span className="text-destructive">*</span></Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={passwordVal}
                onChange={(e) => setPasswordVal(e.target.value)}
                className={formError && (!passwordVal || passwordVal.length < 6) ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>

            {/* Wilayah Tugas Dropdowns */}
            <div className="border border-hairline bg-[var(--color-canvas-soft)]/50 p-3 rounded-lg space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" />
                Wilayah Tugas Admin
              </h4>

              <div className="space-y-1.5">
                <Label htmlFor="add-kec">Pilih Kecamatan <span className="text-destructive">*</span></Label>
                <select
                  id="add-kec"
                  value={selectedKecId}
                  onChange={(e) => {
                    const kecId = e.target.value
                    setSelectedKecId(kecId)
                    setSelectedDesaId('')
                    fetchDesasForKecamatan(kecId)
                  }}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {allKecamatans.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-desa">Pilih Desa/Kelurahan <span className="text-destructive">*</span></Label>
                <select
                  id="add-desa"
                  disabled={!selectedKecId || desasLoading}
                  value={selectedDesaId}
                  onChange={(e) => setSelectedDesaId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{desasLoading ? 'Memuat desa...' : '-- Pilih Desa/Kelurahan --'}</option>
                  {filteredDesas.map(d => (
                    <option key={d.id} value={d.id}>{d.nama}</option>
                  ))}
                </select>
              </div>
            </div>

            {formError && <p className="text-xs text-destructive mt-1 font-medium">{formError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
            <Button onClick={handleAddSubmit} disabled={submitting || !usernameVal.trim() || !namaVal.trim() || !selectedDesaId}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Buat Akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          ─── MODAL: EDIT USER PEMDES ───
          ========================================== */}
      <Dialog open={showEditModal} onOpenChange={(open) => !open && setShowEditModal(false)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Akun Pemdes</DialogTitle>
            <DialogDescription>
              Ubah data nama, wilayah tugas, serta status keaktifan akun.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>Username (Tidak dapat diubah)</Label>
              <Input value={activeUser?.username || ''} disabled className="bg-muted opacity-80" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-nama">Nama Admin/Petugas <span className="text-destructive">*</span></Label>
              <Input
                id="edit-nama"
                value={namaVal}
                onChange={(e) => setNamaVal(e.target.value)}
                className={formError && !namaVal.trim() ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>

            {/* Wilayah Tugas Dropdowns */}
            <div className="border border-hairline bg-[var(--color-canvas-soft)]/50 p-3 rounded-lg space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin size={13} className="text-primary" />
                Wilayah Tugas Admin
              </h4>

              <div className="space-y-1.5">
                <Label htmlFor="edit-kec">Pilih Kecamatan <span className="text-destructive">*</span></Label>
                <select
                  id="edit-kec"
                  value={selectedKecId}
                  onChange={(e) => {
                    const kecId = e.target.value
                    setSelectedKecId(kecId)
                    setSelectedDesaId('')
                    fetchDesasForKecamatan(kecId)
                  }}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {allKecamatans.map(k => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desa">Pilih Desa/Kelurahan <span className="text-destructive">*</span></Label>
                <select
                  id="edit-desa"
                  disabled={!selectedKecId || desasLoading}
                  value={selectedDesaId}
                  onChange={(e) => setSelectedDesaId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-hairline bg-[var(--color-surface)] px-3 py-1.5 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
                >
                  <option value="">{desasLoading ? 'Memuat desa...' : '-- Pilih Desa/Kelurahan --'}</option>
                  {filteredDesas.map(d => (
                    <option key={d.id} value={d.id}>{d.nama}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle Active status */}
            <div className="flex items-center justify-between p-3 border border-hairline rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Status Akun</Label>
                <p className="text-[11px] text-muted-foreground">Aktifkan atau nonaktifkan akun petugas.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActiveVal}
                  onChange={(e) => setIsActiveVal(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
              </label>
            </div>

            {formError && <p className="text-xs text-destructive mt-1 font-medium">{formError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowEditModal(false); setActiveUser(null) }}>Batal</Button>
            <Button onClick={handleEditSubmit} disabled={submitting || !namaVal.trim() || !selectedDesaId}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          ─── MODAL: RESET PASSWORD ───
          ========================================== */}
      <Dialog open={showResetModal} onOpenChange={(open) => !open && setShowResetModal(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key size={18} className="text-primary" />
              <span>Reset Password</span>
            </DialogTitle>
            <DialogDescription>
              Atur ulang password baru untuk akun petugas <strong>{activeUser?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Password Baru <span className="text-destructive">*</span></Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={passwordVal}
                onChange={(e) => setPasswordVal(e.target.value)}
                className={formError && (!passwordVal || passwordVal.length < 6) ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>
            {formError && <p className="text-xs text-destructive mt-1 font-medium">{formError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowResetModal(false); setActiveUser(null) }}>Batal</Button>
            <Button onClick={handleResetPassword} disabled={submitting || !passwordVal || passwordVal.length < 6}>
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          ─── MODAL: QUICK TOGGLE STATUS ───
          ========================================== */}
      <Dialog open={showToggleModal} onOpenChange={(open) => !open && setShowToggleModal(false)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader className="items-center sm:text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${activeUser?.isActive ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
              }`}>
              <AlertCircle size={24} />
            </div>
            <DialogTitle>
              {activeUser?.isActive ? 'Nonaktifkan Akun?' : 'Aktifkan Akun?'}
            </DialogTitle>
            <DialogDescription className="text-center">
              Apakah Anda yakin ingin {activeUser?.isActive ? 'menonaktifkan' : 'mengaktifkan'} akun admin <strong>{activeUser?.username}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowToggleModal(false); setActiveUser(null) }} disabled={submitting}>Batal</Button>
            <Button
              variant={activeUser?.isActive ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
              disabled={submitting}
            >
              {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Ya, {activeUser?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
