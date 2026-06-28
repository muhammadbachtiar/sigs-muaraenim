// Warna marker berdasarkan RSRP (dBm)
export const SIGNAL_COLORS = {
  GOOD: { label: 'Baik', color: '#22c55e', min: -85, max: 0 },
  FAIR: { label: 'Sedang', color: '#eab308', min: -99, max: -86 },
  POOR: { label: 'Buruk', color: '#ef4444', min: -200, max: -100 },
} as const

export function getSignalColor(rsrp: number | null) {
  if (rsrp === null) return { label: 'Tidak ada data', color: '#9ca3af' }
  if (rsrp > -85) return SIGNAL_COLORS.GOOD
  if (rsrp >= -99) return SIGNAL_COLORS.FAIR
  return SIGNAL_COLORS.POOR
}

// Status verifikasi tower
export const TOWER_STATUS = {
  DRAFT: { label: 'Draft', color: '#6b7280' },
  PENDING: { label: 'Menunggu Verifikasi', color: '#f59e0b' },
  APPROVED: { label: 'Disetujui', color: '#22c55e' },
  REJECTED: { label: 'Ditolak', color: '#ef4444' },
} as const

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Map defaults (Kabupaten Muara Enim center)
export const MAP_CENTER = {
  lat: -3.75,
  lng: 103.75,
  zoom: 10,
} as const

// Data filter defaults
export const DEFAULT_DATA_MONTHS = 6
