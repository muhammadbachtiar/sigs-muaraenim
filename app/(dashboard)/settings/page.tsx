'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  User, Lock, Shield, AlertCircle, Loader2, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type ProfileData = {
  id: string
  username: string
  nama: string
  role: 'SUPER_ADMIN' | 'PEMDES'
  createdAt: string
  desaKelurahan: {
    nama: string
    kecamatan: {
      nama: string
    }
  } | null
}

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()

  // --- STATES ---
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit Profile Form
  const [namaVal, setNamaVal] = useState('')
  const [usernameVal, setUsernameVal] = useState('')
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Change Password Form
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Password Visibility toggles
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      toast.error('Silakan login terlebih dahulu.')
      router.push('/login')
    }
  }, [status, router])

  // --- FETCH PROFILE ---
  const fetchProfile = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/profile').then(r => r.json())
      if (res.success) {
        setProfile(res.data)
        setNamaVal(res.data.nama)
        setUsernameVal(res.data.username)
      } else {
        toast.error(res.message || 'Gagal mengambil data profil')
      }
    } catch {
      toast.error('Kesalahan jaringan saat memuat profil')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProfile()
    }
  }, [status])

  // --- HANDLERS ---
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaVal.trim()) return setProfileError('Nama Lengkap wajib diisi')
    if (usernameVal.trim().length < 3) return setProfileError('Username minimal 3 karakter')

    setProfileError('')
    setProfileSubmitting(true)

    const payload = {
      nama: namaVal.trim(),
      username: usernameVal.trim().toLowerCase().replace(/\s+/g, ''),
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        toast.success('Profil berhasil diperbarui')

        // Refresh local state
        setProfile(prev => prev ? { ...prev, nama: res.data.nama, username: res.data.username } : null)

        // Trigger NextAuth session update
        await update({
          name: res.data.nama,
          nama: res.data.nama,
        })

        // Slightly delay page reload to sync state visually
        setTimeout(() => {
          window.location.reload()
        }, 800)
      } else {
        setProfileError(res.message)
      }
    } catch {
      setProfileError('Terjadi kesalahan jaringan')
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword) return setPasswordError('Password lama wajib diisi')
    if (newPassword.length < 6) return setPasswordError('Password baru minimal 6 karakter')
    if (newPassword !== confirmPassword) return setPasswordError('Konfirmasi password tidak cocok')

    setPasswordError('')
    setPasswordSubmitting(true)

    const payload = {
      oldPassword,
      newPassword,
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        toast.success('Password berhasil diperbarui')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setPasswordError(res.message)
      }
    } catch {
      setPasswordError('Terjadi kesalahan jaringan')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ubah informasi profil dangan kata sandi akun Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Summary Card */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-hairline shadow-soft bg-gradient-to-b from-primary/5 via-transparent to-transparent">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                <User size={32} />
              </div>
              <CardTitle className="text-base truncate">{profile?.nama}</CardTitle>
              <CardDescription className="font-mono text-xs truncate">@{profile?.username}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2 text-xs">
              <div className="border-t border-hairline pt-3 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Peran Akses</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary text-[10px]">
                    <Shield size={10} />
                    {profile?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Operator Pemdes'}
                  </span>
                </div>

                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground shrink-0">Wilayah Tugas</span>
                  {profile?.desaKelurahan ? (
                    <span className="text-right font-medium text-foreground">
                      {profile.desaKelurahan.nama}
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        Kec. {profile.desaKelurahan.kecamatan?.nama || '-'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-right text-muted-foreground italic">Kabupaten (Semua)</span>
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-hairline pt-3">
                  <span className="text-muted-foreground">Bergabung Sejak</span>
                  <span className="font-mono text-foreground">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                      : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Edit Profile & Password Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Card: Edit Profile */}
          <Card className="border-hairline shadow-soft bg-[var(--color-surface)]">
            <CardHeader className="border-b border-hairline p-5 pb-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User size={16} className="text-primary" />
                Informasi Profil
              </CardTitle>
              <CardDescription className="text-xs">Ubah data identitas umum akun Anda.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpdateProfile} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-username">Username</Label>
                    <Input
                      id="profile-username"
                      value={usernameVal}
                      onChange={(e) => setUsernameVal(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="Masukkan username baru"
                    />
                    <span className="text-[10px] text-muted-foreground">Gunakan huruf kecil tanpa spasi.</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-nama">Nama Lengkap</Label>
                    <Input
                      id="profile-nama"
                      value={namaVal}
                      onChange={(e) => setNamaVal(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>
                </div>

                {profileError && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertCircle size={14} />
                    {profileError}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={profileSubmitting}>
                    {profileSubmitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card: Change Password */}
          <Card className="border-hairline shadow-soft bg-[var(--color-surface)]">
            <CardHeader className="border-b border-hairline p-5 pb-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock size={16} className="text-primary" />
                Ubah Kata Sandi
              </CardTitle>
              <CardDescription className="text-xs">Ganti kata sandi secara rutin untuk keamanan tambahan.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpdatePassword} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="pass-old">Password Lama</Label>
                  <div className="relative">
                    <Input
                      id="pass-old"
                      type={showOldPass ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Masukkan password lama Anda"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass(!showOldPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pass-new">Password Baru</Label>
                    <div className="relative">
                      <Input
                        id="pass-new"
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pass-confirm">Konfirmasi Password Baru</Label>
                    <div className="relative">
                      <Input
                        id="pass-confirm"
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {passwordError && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertCircle size={14} />
                    {passwordError}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={passwordSubmitting}>
                    {passwordSubmitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                    Perbarui Kata Sandi
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
