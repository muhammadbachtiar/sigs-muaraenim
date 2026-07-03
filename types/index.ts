export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  meta?: PaginationMeta
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface BBoxParams {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export interface SessionUser {
  id: string
  username: string
  nama: string
  role: 'SUPER_ADMIN' | 'PEMDES'
  desaKelurahanId: string | null
}
