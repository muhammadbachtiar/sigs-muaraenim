'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Radio,
  TowerControl,
  Database,
  Users,
  Map,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sinyal', label: 'Riwayat Sinyal', icon: Radio },
  { href: '/tower', label: 'Manajemen Tower', icon: TowerControl },
  { href: '/master', label: 'Master Data', icon: Database },
  { href: '/demografi', label: 'Demografi Desa', icon: Users },
  { href: '/peta', label: 'Peta Publik', icon: Map, external: true },
]

const adminOnlyItems = ['/master']

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const userRole = (session?.user as any)?.role
  const userName = (session?.user as any)?.nama || session?.user?.name

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Prevent body scroll when sidebar overlay is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const filteredNav = navItems.filter((item) => {
    if (adminOnlyItems.includes(item.href) && userRole !== 'SUPER_ADMIN') return false
    return true
  })

  // Build breadcrumb segments from pathname
  const breadcrumbSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      href: '/' + arr.slice(0, i + 1).join('/'),
    }))

  return (
    <div className="dash-root">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="dash-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar ${sidebarOpen ? 'dash-sidebar--open' : ''}`}>
        {/* Logo */}
        <div className="dash-sidebar__logo">
          <h2 className="dash-sidebar__title">SIGS Muara Enim</h2>
          <p className="dash-sidebar__subtitle">Sistem Informasi Geografis Signal</p>
        </div>

        {/* Nav items */}
        <nav className="dash-sidebar__nav">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dash-nav-item"
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </a>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dash-nav-item ${isActive ? 'dash-nav-item--active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="dash-sidebar__footer">
          <div className="dash-sidebar__user-name">{userName}</div>
          <div className="dash-sidebar__user-role">
            {userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Pemdes'}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="dash-sidebar__logout"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="dash-hamburger"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Breadcrumb */}
          <nav className="dash-breadcrumb" aria-label="Breadcrumb">
            <Link href="/" className="dash-breadcrumb__item">Dashboard</Link>
            {breadcrumbSegments.map((seg, i) => (
              <span key={seg.href} className="dash-breadcrumb__sep">
                <ChevronRight size={14} />
                {i === breadcrumbSegments.length - 1 ? (
                  <span className="dash-breadcrumb__current">{seg.label}</span>
                ) : (
                  <Link href={seg.href} className="dash-breadcrumb__item">{seg.label}</Link>
                )}
              </span>
            ))}
          </nav>
        </header>

        {/* Content */}
        <main className="dash-content">
          {children}
        </main>
      </div>

      {/* Scoped responsive CSS */}
      <style>{`
        .dash-root {
          display: flex;
          min-height: 100vh;
        }

        /* ─── Overlay ─── */
        .dash-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 40;
          backdrop-filter: blur(2px);
        }

        /* ─── Sidebar ─── */
        .dash-sidebar {
          width: 260px;
          background: var(--color-surface);
          border-right: 1px solid var(--color-hairline);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          bottom: 0;
          z-index: 50;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dash-sidebar__logo {
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--color-hairline);
        }
        .dash-sidebar__title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.5px;
          line-height: 1.2;
        }
        .dash-sidebar__subtitle {
          font-size: 0.6875rem;
          color: var(--color-ink-faint);
          margin-top: 2px;
        }
        .dash-sidebar__nav {
          flex: 1;
          padding: 8px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .dash-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          color: var(--color-ink-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 400;
          transition: background 0.15s, color 0.15s;
        }
        .dash-nav-item:hover {
          background: var(--color-canvas-soft);
        }
        .dash-nav-item--active {
          background: #eef6ff;
          color: var(--color-primary);
          font-weight: 600;
        }
        .dash-sidebar__footer {
          padding: 16px 20px;
          border-top: 1px solid var(--color-hairline);
        }
        .dash-sidebar__user-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .dash-sidebar__user-role {
          font-size: 0.6875rem;
          color: var(--color-ink-faint);
          margin-bottom: 8px;
        }
        .dash-sidebar__logout {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8125rem;
          color: var(--color-ink-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .dash-sidebar__logout:hover {
          color: var(--color-danger);
        }

        /* ─── Main ─── */
        .dash-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-width: 0;
        }
        .dash-topbar {
          height: 52px;
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-hairline);
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 12px;
          flex-shrink: 0;
        }
        .dash-hamburger {
          display: none;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--color-ink);
          padding: 4px;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .dash-hamburger:hover {
          background: var(--color-canvas-soft);
        }
        .dash-breadcrumb {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8125rem;
          color: var(--color-ink-muted);
          overflow: hidden;
        }
        .dash-breadcrumb__item {
          color: var(--color-ink-muted);
          text-decoration: none;
          white-space: nowrap;
        }
        .dash-breadcrumb__item:hover {
          color: var(--color-primary);
        }
        .dash-breadcrumb__sep {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--color-ink-faint);
        }
        .dash-breadcrumb__current {
          color: var(--color-ink);
          font-weight: 500;
          white-space: nowrap;
        }
        .dash-content {
          flex: 1;
          padding: 24px;
        }

        /* ─── Desktop (>= 769px) ─── */
        @media (min-width: 769px) {
          .dash-sidebar {
            transform: translateX(0);
          }
          .dash-main {
            margin-left: 260px;
          }
        }

        /* ─── Mobile (< 769px) ─── */
        @media (max-width: 768px) {
          .dash-sidebar {
            transform: translateX(-100%);
          }
          .dash-sidebar--open {
            transform: translateX(0);
          }
          .dash-hamburger {
            display: flex;
          }
          .dash-content {
            padding: 16px;
          }
          .dash-topbar {
            padding: 0 16px;
          }
        }
      `}</style>
    </div>
  )
}
