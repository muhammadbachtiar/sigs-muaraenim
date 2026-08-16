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
  UserCog,
  FileText,
  AlertTriangle,
  PanelLeftClose,
  PanelLeft,
  Signal,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const PwaBanner = dynamic(() => import('@/components/common/PwaBanner'), { ssr: false })

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sinyal', label: 'Riwayat Sinyal', icon: Radio },
  { href: '/tower', label: 'Manajemen Tower', icon: TowerControl },
  { href: '/master', label: 'Master Data', icon: Database },
  { href: '/demografi', label: 'Demografi Desa', icon: Users },
  { href: '/draf', label: 'Draf Tersimpan', icon: FileText },
  { href: '/users', label: 'Manajemen User', icon: UserCog },
  { href: '/peta', label: 'Peta Publik', icon: Map },
]

const adminOnlyItems = ['/master', '/users']

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // Desktop sidebar collapse state
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)

  const userRole = (session?.user as any)?.role
  const userName = (session?.user as any)?.nama || session?.user?.name || 'Pengguna'

  // Load user preference for desktop collapse from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sigs_sidebar_collapsed')
      if (saved !== null) {
        setIsDesktopCollapsed(saved === 'true')
      }
    } catch {
      /* ignore */
    }
  }, [])

  const toggleDesktopSidebar = () => {
    setIsDesktopCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sigs_sidebar_collapsed', String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile sidebar overlay is open
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

  // Effective expanded state on desktop: expanded if not collapsed OR when hovered
  const isDesktopExpanded = !isDesktopCollapsed || isSidebarHovered

  // Build breadcrumb segments from pathname
  const breadcrumbSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      href: '/' + arr.slice(0, i + 1).join('/'),
    }))

  return (
    <div className={`dash-root ${isDesktopCollapsed ? 'dash-root--collapsed' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="dash-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => {
          if (isDesktopCollapsed) setIsSidebarHovered(true)
        }}
        onMouseLeave={() => {
          if (isDesktopCollapsed) setIsSidebarHovered(false)
        }}
        className={`dash-sidebar ${sidebarOpen ? 'dash-sidebar--open' : ''} ${
          isDesktopCollapsed ? 'dash-sidebar--collapsed' : ''
        } ${isDesktopCollapsed && isSidebarHovered ? 'dash-sidebar--hover-expanded' : ''}`}
      >
        {/* Logo Header */}
        <div className={`dash-sidebar__logo ${!isDesktopExpanded ? 'dash-sidebar__logo--mini' : ''}`}>
          <div className="flex items-center gap-2.5 min-w-0 w-full">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 font-bold">
              <Signal size={18} />
            </div>
            {isDesktopExpanded && (
              <div className="dash-sidebar__logo-text min-w-0 flex-1 animate-in fade-in duration-150">
                <h2 className="dash-sidebar__title truncate">SIGS Muara Enim</h2>
                <p className="dash-sidebar__subtitle truncate">Sistem Informasi Geografis Signal</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav items */}
        <nav className="dash-sidebar__nav">
          {filteredNav.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                title={!isDesktopExpanded ? item.label : undefined}
                className={`dash-nav-item ${isActive ? 'dash-nav-item--active' : ''} ${
                  !isDesktopExpanded ? 'dash-nav-item--mini' : ''
                }`}
              >
                <div className="dash-nav-item__icon shrink-0">
                  <Icon size={18} />
                </div>
                {isDesktopExpanded && (
                  <span className="dash-nav-item__label truncate flex-1 animate-in fade-in duration-150">
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className={`dash-sidebar__footer ${!isDesktopExpanded ? 'dash-sidebar__footer--mini' : ''}`}>
          {isDesktopExpanded ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="dash-sidebar__user-name truncate" title={userName}>{userName}</div>
                  <div className="dash-sidebar__user-role">
                    {userRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Pemdes'}
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-[var(--color-canvas-soft)] transition-colors shrink-0"
                  title="Pengaturan Akun"
                >
                  <UserCog size={15} />
                </Link>
              </div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="dash-sidebar__logout"
              >
                <LogOut size={12} />
                Keluar
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/settings"
                className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-primary rounded-lg hover:bg-[var(--color-canvas-soft)] transition-colors"
                title={`Profil: ${userName}`}
              >
                <UserCog size={16} />
              </Link>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Keluar"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '28px 24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              animation: 'fadeInScale 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '6px' }}>
                  Keluar dari SIGS?
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                  Sesi Anda akan dihapus dan Anda perlu masuk kembali untuk mengakses dashboard.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '4px' }}>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '9999px',
                    border: '1px solid var(--color-hairline)',
                    background: 'var(--color-canvas-soft)',
                    fontSize: '0.875rem', fontWeight: 500,
                    color: 'var(--color-ink-secondary)', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowLogoutModal(false)
                    const savedUsername = localStorage.getItem('sigs_remember_username')
                    localStorage.clear()
                    sessionStorage.clear()
                    if (savedUsername) {
                      localStorage.setItem('sigs_remember_username', savedUsername)
                    }
                    signOut({ callbackUrl: '/login' })
                  }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '9999px',
                    border: 'none',
                    background: '#dc2626',
                    fontSize: '0.875rem', fontWeight: 600,
                    color: '#fff', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PwaBanner />

      {/* Main area */}
      <div className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="dash-hamburger"
            aria-label="Toggle menu mobile"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Desktop Sidebar Toggle Button */}
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="dash-desktop-toggle"
            title={isDesktopCollapsed ? 'Buka Sidebar (Pin)' : 'Tutup Sidebar (Mini Rail)'}
            aria-label="Toggle desktop sidebar"
          >
            {isDesktopCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
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
          transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s;
        }
        .dash-sidebar__logo {
          padding: 16px 16px 14px;
          border-bottom: 1px solid var(--color-hairline);
          height: 60px;
          display: flex;
          align-items: center;
        }
        .dash-sidebar__logo--mini {
          padding: 16px 0;
          justify-content: center;
        }
        .dash-sidebar__logo--mini > div {
          justify-content: center;
        }
        .dash-sidebar__title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.3px;
          line-height: 1.2;
        }
        .dash-sidebar__subtitle {
          font-size: 0.6875rem;
          color: var(--color-ink-faint);
          margin-top: 1px;
        }
        .dash-sidebar__nav {
          flex: 1;
          padding: 10px 8px;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .dash-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          border-radius: 8px;
          color: var(--color-ink-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 400;
          transition: background 0.15s, color 0.15s, padding 0.2s;
          white-space: nowrap;
        }
        .dash-nav-item:hover {
          background: var(--color-canvas-soft);
          color: var(--color-ink);
        }
        .dash-nav-item--active {
          background: #eef6ff;
          color: var(--color-primary);
          font-weight: 600;
        }
        .dash-nav-item--mini {
          padding: 9px 0;
          justify-content: center;
          gap: 0;
        }
        .dash-nav-item--mini .dash-nav-item__icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dash-sidebar__footer {
          padding: 14px 16px;
          border-top: 1px solid var(--color-hairline);
          transition: padding 0.2s;
        }
        .dash-sidebar__footer--mini {
          padding: 12px 0;
          display: flex;
          justify-content: center;
        }
        .dash-sidebar__user-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .dash-sidebar__user-role {
          font-size: 0.6875rem;
          color: var(--color-ink-faint);
          margin-bottom: 0;
        }
        .dash-sidebar__logout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-ink-muted);
          background: var(--color-canvas-soft);
          border: 1px solid var(--color-hairline);
          border-radius: 6px;
          cursor: pointer;
          padding: 6px 12px;
          width: 100%;
          transition: all 0.15s ease;
        }
        .dash-sidebar__logout:hover {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fca5a5;
        }

        /* ─── Main ─── */
        .dash-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-width: 0;
          transition: margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dash-topbar {
          height: 54px;
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
          padding: 6px;
          border-radius: 6px;
          flex-shrink: 0;
        }
        .dash-hamburger:hover {
          background: var(--color-canvas-soft);
        }
        .dash-desktop-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid var(--color-hairline);
          border-radius: 6px;
          color: var(--color-ink-muted);
          width: 32px;
          height: 32px;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .dash-desktop-toggle:hover {
          background: var(--color-canvas-soft);
          color: var(--color-primary);
          border-color: var(--color-primary);
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
          .dash-desktop-toggle {
            display: flex;
          }
          .dash-sidebar {
            transform: translateX(0);
          }
          .dash-main {
            margin-left: 260px;
          }

          /* Collapsed Desktop State */
          .dash-root--collapsed .dash-main {
            margin-left: 68px;
          }
          .dash-sidebar--collapsed {
            width: 68px;
          }

          /* Hover Auto-Expand */
          .dash-sidebar--hover-expanded {
            width: 260px;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
            z-index: 60;
          }
        }

        /* ─── Mobile (< 769px) ─── */
        @media (max-width: 768px) {
          .dash-sidebar {
            transform: translateX(-100%);
            width: 260px !important;
          }
          .dash-sidebar--open {
            transform: translateX(0);
          }
          .dash-hamburger {
            display: flex;
          }
          .dash-main {
            margin-left: 0 !important;
          }
          .dash-content {
            padding: 16px;
          }
          .dash-topbar {
            padding: 0 16px;
          }
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
