import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Peta Sinyal — SIGS Muara Enim',
  description: 'Peta sebaran sinyal seluler Kabupaten Muara Enim',
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-hairline)',
          padding: 'var(--space-sm) var(--space-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          href="/peta"
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--color-ink)',
            textDecoration: 'none',
            letterSpacing: '-0.25px',
          }}
        >
          SIGS Muara Enim
        </Link>
        <Link
          href="/login"
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-primary)',
            textDecoration: 'none',
          }}
        >
          Login
        </Link>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}
