'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'

// ─── Zustand Store untuk Status Online ────────────────────────────────────────

type OnlineStore = {
  isOnline: boolean
  setOnline: (v: boolean) => void
}

export const useOnlineStore = create<OnlineStore>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (v) => set({ isOnline: v }),
}))

// ─── Hook: useOnlineStatus ────────────────────────────────────────────────────
// Memantau status koneksi dan memunculkan toast WA/Instagram style
// saat terjadi transisi Online ↔ Offline.

export function useOnlineStatus() {
  const { isOnline, setOnline } = useOnlineStore()
  const offlineToastId = useRef<string | number | undefined>(undefined)
  const hasInitialized = useRef(false)

  const handleOnline = useCallback(() => {
    setOnline(true)

    // Dismiss offline toast jika masih tampil
    if (offlineToastId.current) {
      toast.dismiss(offlineToastId.current)
      offlineToastId.current = undefined
    }

    // Tampilkan toast hijau yang auto-dismiss setelah 4 detik
    toast.success('Koneksi terhubung kembali.', {
      duration: 4000,
      id: 'online-status',
    })
  }, [setOnline])

  const handleOffline = useCallback(() => {
    setOnline(false)

    // Tampilkan toast merah yang tetap tampil selama offline (duration: Infinity)
    offlineToastId.current = toast.error(
      'Koneksi internet terputus. Anda bekerja dalam mode offline.',
      {
        duration: Infinity,
        id: 'offline-status',
      },
    )
  }, [setOnline])

  useEffect(() => {
    // Sinkronisasi state awal
    setOnline(navigator.onLine)

    // Tampilkan toast offline jika memang sudah offline saat mount (tapi hanya sekali)
    if (!navigator.onLine && !hasInitialized.current) {
      handleOffline()
    }
    hasInitialized.current = true

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline, setOnline])

  return isOnline
}
