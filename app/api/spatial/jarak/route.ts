import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const lat1 = parseFloat(params.get('lat1') ?? '')
    const lon1 = parseFloat(params.get('lon1') ?? '')
    const lat2 = parseFloat(params.get('lat2') ?? '')
    const lon2 = parseFloat(params.get('lon2') ?? '')

    if ([lat1, lon1, lat2, lon2].some(isNaN)) {
      return errorResponse('Parameter lat1, lon1, lat2, lon2 wajib diisi')
    }

    const result = await prisma.$queryRaw<[{ jarak_meter: number }]>`
      SELECT ST_DistanceSphere(
        ST_MakePoint(${lon1}, ${lat1}),
        ST_MakePoint(${lon2}, ${lat2})
      ) AS jarak_meter
    `

    const jarakKm = Number(result[0].jarak_meter) / 1000
    return successResponse({ jarak_meter: Number(result[0].jarak_meter), jarak_km: Math.round(jarakKm * 100) / 100 }, 'Jarak berhasil dihitung')
  } catch {
    return serverErrorResponse()
  }
}
