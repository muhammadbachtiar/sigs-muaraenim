'use client'

import { useState, useEffect } from 'react'
import { Download, X, MapPin, ChevronRight } from 'lucide-react'

const PWA_DISMISSED_KEY = 'sigs_pwa_prompt_dismissed'
const LOCATION_GUIDED_KEY = 'sigs_location_guide_shown'

export default function PwaBanner() {
  const [showPwa, setShowPwa] = useState(false)
  const [showLocationGuide, setShowLocationGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      const dismissed = localStorage.getItem(PWA_DISMISSED_KEY)
      if (!dismissed) {
        // Delay to avoid showing immediately on load
        setTimeout(() => {
          setShowPwa(true)
          setTimeout(() => setVisible(true), 50)
        }, 3000)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Location permission guide (only if not shown before)
    const locationGuideShown = localStorage.getItem(LOCATION_GUIDED_KEY)
    if (!locationGuideShown && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        if (result.state === 'prompt') {
          setTimeout(() => {
            setShowLocationGuide(true)
          }, 1500)
        }
      }).catch(() => {/* ignore */})
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      dismissPwa()
    }
  }

  const dismissPwa = () => {
    setVisible(false)
    setTimeout(() => setShowPwa(false), 300)
    localStorage.setItem(PWA_DISMISSED_KEY, '1')
  }

  const handleAllowLocation = () => {
    navigator.geolocation.getCurrentPosition(
      () => {/* success */},
      () => {/* denied */}
    )
    localStorage.setItem(LOCATION_GUIDED_KEY, '1')
    setShowLocationGuide(false)
  }

  const dismissLocationGuide = () => {
    localStorage.setItem(LOCATION_GUIDED_KEY, '1')
    setShowLocationGuide(false)
  }

  return (
    <>
      {/* Location Guide Tooltip — top-right */}
      {showLocationGuide && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            zIndex: 900,
            maxWidth: '300px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-hairline)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.14)',
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={18} color="#3b82f6" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '4px' }}>
                Izinkan Akses Lokasi
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
                Izin lokasi membantu anda mengisi koordinat pengukuran sinyal secara otomatis dan akurat.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAllowLocation}
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: '9999px',
                    background: '#3b82f6', color: '#fff',
                    border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  Izinkan <ChevronRight size={12} />
                </button>
                <button
                  onClick={dismissLocationGuide}
                  style={{
                    padding: '7px 12px', borderRadius: '9999px',
                    background: 'var(--color-canvas-soft)',
                    border: '1px solid var(--color-hairline)',
                    fontSize: '0.75rem', fontWeight: 500,
                    color: 'var(--color-ink-muted)', cursor: 'pointer',
                  }}
                >
                  Nanti
                </button>
              </div>
            </div>
            <button
              onClick={dismissLocationGuide}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-faint)', flexShrink: 0, padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* PWA Install Banner — slide up from bottom */}
      {showPwa && (
        <div
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: `translateX(-50%) translateY(${visible ? '0' : '120px'})`,
            zIndex: 900,
            width: 'calc(100% - 32px)',
            maxWidth: '420px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 12px 40px rgba(2, 132, 199, 0.4)',
            transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
            opacity: visible ? 1 : 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
              background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Download size={20} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                Pasang Aplikasi SIGS
              </p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>
                Akses lebih cepat tanpa membuka browser
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={handleInstall}
                style={{
                  padding: '8px 14px', borderRadius: '9999px',
                  background: '#fff', color: '#0284c7',
                  border: 'none', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Pasang
              </button>
              <button
                onClick={dismissPwa}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none',
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#fff',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
