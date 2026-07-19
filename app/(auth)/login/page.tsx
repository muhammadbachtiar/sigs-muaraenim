'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Signal, TowerControl, Map, FileText } from 'lucide-react'

// ─── Shortcut Grid (MyBCA Style) ──────────────────────────────────────────────

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

function ShortcutGrid({ onShortcut }: { onShortcut: (href: string, isPublic?: boolean) => void }) {
  return (
    <div style={{ marginTop: 'var(--space-lg)' }}>
      <p
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--color-ink-muted)',
          textAlign: 'center',
          marginBottom: 'var(--space-sm)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Akses Cepat
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        {SHORTCUTS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.label}
              onClick={() => onShortcut(s.href, s.isPublic)}
              type="button"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 4px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-hairline)',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = s.bgColor
                e.currentTarget.style.borderColor = s.color + '40'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)'
                e.currentTarget.style.borderColor = 'var(--color-hairline)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: s.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} color={s.color} />
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--color-ink-secondary)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}
              >
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status: authStatus } = useSession()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      setError('Username atau password salah')
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  const handleShortcut = (href: string, isPublic?: boolean) => {
    if (isPublic) {
      // Halaman publik tidak perlu login
      router.push(href)
    } else {
      // Butuh login — set callbackUrl ke href
      const params = new URLSearchParams({ callbackUrl: href })
      router.push(`/login?${params.toString()}`)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-canvas-soft)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xxl)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 18px rgba(0,0,0,0.03)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <img
            src="/logo_muara_enim.png"
            alt="Logo Muara Enim"
            style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: '14px' }}
          />
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              letterSpacing: '-0.5px',
            }}
          >
            SIGS Muara Enim
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-ink-muted)',
              marginTop: 'var(--space-xs)',
            }}
          >
            Sistem Informasi Geografis Signal
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {error && (
            <div
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-ink-secondary)',
                marginBottom: 'var(--space-xxs)',
              }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-ink-secondary)',
                marginBottom: 'var(--space-xxs)',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? 'var(--color-ink-faint)' : 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 'var(--space-xs)',
            }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        {/* Shortcut Grid ala MyBCA */}
        <ShortcutGrid onShortcut={handleShortcut} />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-canvas-soft)',
        color: 'var(--color-ink-muted)'
      }}>
        Loading...
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
