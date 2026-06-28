'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
          maxWidth: '400px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xxl)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 18px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
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

