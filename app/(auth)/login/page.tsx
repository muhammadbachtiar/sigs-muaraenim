'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Signal, TowerControl, Map, FileText, Lock, ChevronRight, Loader2 } from 'lucide-react'

// ─── Shortcut Config ─────────────────────────────────────────────────────────
const SHORTCUTS = [
  {
    label: 'Input Sinyal',
    icon: Signal,
    href: '/sinyal?action=create',
    color: '#3b82f6',
    bgColor: '#eff6ff',
  },
  {
    label: 'Ajukan Tower',
    icon: TowerControl,
    href: '/tower?action=create',
    color: '#14b8a6',
    bgColor: '#f0fdfa',
  },
  {
    label: 'Peta Publik',
    icon: Map,
    href: '/peta',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    isPublic: true,
  },
  {
    label: 'Daftar Draf',
    icon: FileText,
    href: '/draf',
    color: '#f59e0b',
    bgColor: '#fffbeb',
  },
]

// ─── Login Form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status: authStatus } = useSession()
  const rawCallbackUrl = searchParams.get('callbackUrl') || '/'
  const callbackUrl = (rawCallbackUrl.match(/\.(png|jpg|jpeg|svg|webp|ico|json|geojson)$/i) || rawCallbackUrl.includes('.well-known'))
    ? '/'
    : rawCallbackUrl

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // Intent state: shortcut yang dipilih sebelum login
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const usernameRef = useRef<HTMLInputElement>(null)

  // Load remembered username from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sigs_remember_username')
    if (saved) {
      setUsername(saved)
      setRememberMe(true)
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [authStatus, callbackUrl, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Username atau password salah. Coba lagi.')
      return
    }

    // Handle remember me
    if (rememberMe) {
      localStorage.setItem('sigs_remember_username', username)
    } else {
      localStorage.removeItem('sigs_remember_username')
    }

    // Navigate to callbackUrl (redirect to pending shortcut href if set)
    const destination = pendingHref || callbackUrl
    router.push(destination)
    router.refresh()
  }

  const handleShortcut = (href: string, label: string, isPublic?: boolean) => {
    if (isPublic) {
      router.push(href)
      return
    }
    // Set intent state
    setPendingLabel(label)
    setPendingHref(href)
    // Update URL callbackUrl
    const params = new URLSearchParams({ callbackUrl: href })
    router.replace(`/login?${params.toString()}`, { scroll: false })
    // Focus username input
    setTimeout(() => usernameRef.current?.focus(), 100)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 50%, #f0f3ff 100%)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '20px',
          padding: '32px 28px 28px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08)',
          border: '1px solid var(--color-hairline)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {!logoError ? (
            <img
              src="/logo_muara_enim.png"
              alt="Logo Kabupaten Muara Enim"
              onError={() => setLogoError(true)}
              style={{ width: 60, height: 60, margin: '0 auto 12px', borderRadius: '16px', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <Signal size={28} color="#fff" />
            </div>
          )}
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--color-ink)', letterSpacing: '-0.5px' }}>
            SIGS Muara Enim
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
            Sistem Informasi Geografis Signal
          </p>
        </div>

        {/* Intent Banner */}
        {pendingLabel && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
              border: '1px solid #bfdbfe',
              marginBottom: '16px',
              animation: 'intentBannerIn 0.3s ease-out',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Lock size={14} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', margin: 0 }}>
                Login untuk melanjutkan
              </p>
              <p style={{ fontSize: '0.6875rem', color: '#3b82f6', margin: 0, marginTop: '1px' }}>
                Setelah login, Anda akan langsung diarahkan ke: <strong>{pendingLabel}</strong>
              </p>
            </div>
            <ChevronRight size={14} color="#3b82f6" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '10px',
              fontSize: '0.875rem',
              marginBottom: '16px',
              border: '1px solid #fecaca',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label htmlFor="username" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
              Username
            </label>
            <input
              id="username"
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Masukkan username Anda"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid var(--color-hairline)',
                borderRadius: '10px',
                fontSize: '0.9375rem',
                outline: 'none',
                transition: 'border-color 0.15s',
                background: 'var(--color-canvas-soft)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#fff' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-hairline)'; e.currentTarget.style.background = 'var(--color-canvas-soft)' }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-ink-secondary)', marginBottom: '6px' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid var(--color-hairline)',
                borderRadius: '10px',
                fontSize: '0.9375rem',
                outline: 'none',
                transition: 'border-color 0.15s',
                background: 'var(--color-canvas-soft)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#fff' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-hairline)'; e.currentTarget.style.background = 'var(--color-canvas-soft)' }}
            />
          </div>

          {/* Remember Me */}
          <label
            htmlFor="rememberMe"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
          >
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-ink-secondary)', fontWeight: 500 }}>
              Ingat Saya
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? 'var(--color-ink-faint)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(2, 132, 199, 0.35)',
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Shortcut Grid ala MyBCA */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-hairline)' }} />
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              Akses Cepat
            </p>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-hairline)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {SHORTCUTS.map((s) => {
              const Icon = s.icon
              const isSelected = pendingHref === s.href
              return (
                <button
                  key={s.label}
                  onClick={() => handleShortcut(s.href, s.label, s.isPublic)}
                  type="button"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 6px',
                    borderRadius: '14px',
                    border: isSelected ? `2px solid ${s.color}` : '1.5px solid var(--color-hairline)',
                    backgroundColor: isSelected ? s.bgColor : 'var(--color-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: isSelected ? `0 4px 16px ${s.color}30` : 'none',
                    outline: 'none',
                    position: 'relative' as const,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = s.bgColor
                      e.currentTarget.style.borderColor = s.color + '60'
                      e.currentTarget.style.transform = 'scale(1.03) translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                      e.currentTarget.style.borderColor = 'var(--color-hairline)'
                      e.currentTarget.style.transform = 'scale(1)'
                    }
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <div
                    style={{
                      width: '38px', height: '38px', borderRadius: '12px',
                      backgroundColor: s.bgColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <Icon size={18} color={s.color} />
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-ink-secondary)', textAlign: 'center', lineHeight: 1.2 }}>
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes intentBannerIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 50%, #f0f3ff 100%)',
        color: 'var(--color-ink-muted)',
      }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
