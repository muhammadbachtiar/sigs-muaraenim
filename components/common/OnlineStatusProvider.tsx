'use client'

import { useEffect } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Komponen client-only yang:
 * 1. Meregistrasi Service Worker
 * 2. Mengaktifkan pemantauan koneksi online/offline dengan toast
 */
export default function OnlineStatusProvider() {
  // Aktifkan hook pemantau koneksi
  useOnlineStatus()

  // Registrasi Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Registered:', reg.scope)
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err)
        })
    }
  }, [])

  return null
}
