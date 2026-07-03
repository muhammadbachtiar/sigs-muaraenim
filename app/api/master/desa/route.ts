import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { desaSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const isSelect = params.get('is_select') === 'true'
    if (isSelect) {
      const kecamatanIds = params.getAll('kecamatan_id')
        .flatMap(id => id.split(','))
        .map(id => id.trim())
        .filter(id => id !== '')

      const where: any = {}
      if (kecamatanIds.length > 0) {
        where.kecamatanId = { in: kecamatanIds }
      }

      const data = await prisma.desaKelurahan.findMany({
        where,
        orderBy: { nama: 'asc' },
        select: { id: true, nama: true, kecamatanId: true }
      })
      return successResponse(data, 'Data desa untuk select berhasil diambil')
    }

    const { page, pageSize, skip, take, search } = parsePagination(params)
    
    // Parse multiple kecamatan_id (supports ?kecamatan_id=1&kecamatan_id=2 or ?kecamatan_id=1,2)
    const kecamatanIds = params.getAll('kecamatan_id')
      .flatMap(id => id.split(','))
      .map(id => id.trim())
      .filter(id => id !== '')

    const where: any = {}
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' as const } },
        { kodeDesa: { contains: search, mode: 'insensitive' as const } },
      ]
    }
    
    if (kecamatanIds.length > 0) {
      where.kecamatanId = { in: kecamatanIds }
    }

    const [data, total] = await Promise.all([
      prisma.desaKelurahan.findMany({
        where,
        skip,
        take,
        orderBy: { nama: 'asc' },
        include: {
          kecamatan: { select: { id: true, nama: true } },
          demografi: true,
        },
      }),
      prisma.desaKelurahan.count({ where }),
    ])

    return successResponse(data, 'Data desa/kelurahan berhasil diambil', paginationMeta(total, page, pageSize))
  } catch {
    return serverErrorResponse()
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const body = await request.json()
    const nama = body.nama?.trim()
    if (!nama) return errorResponse('Nama desa/kelurahan wajib diisi')

    const tipe = body.tipe
    if (!tipe || (tipe !== 'DESA' && tipe !== 'KELURAHAN')) {
      return errorResponse('Tipe wajib dipilih (DESA atau KELURAHAN)')
    }

    const kecamatanId = body.kecamatanId
    if (!kecamatanId) return errorResponse('Kecamatan wajib dipilih')

    const kecamatan = await prisma.kecamatan.findUnique({ where: { id: kecamatanId } })
    if (!kecamatan) return errorResponse('Kecamatan tidak ditemukan')

    // Check duplicate name
    const existingNama = await prisma.desaKelurahan.findFirst({ where: { nama } })
    if (existingNama) return errorResponse('Desa/kelurahan dengan nama ini sudah ada')

    // Check duplicate kodeDesa
    const kodeDesa = body.kodeDesa?.trim() || null
    if (kodeDesa) {
      const existingKode = await prisma.desaKelurahan.findUnique({ where: { kodeDesa } })
      if (existingKode) return errorResponse('Desa/kelurahan dengan kode ini sudah ada')
    }

    const lat = body.latitude != null ? parseFloat(body.latitude) : null
    const lng = body.longitude != null ? parseFloat(body.longitude) : null
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      return errorResponse('Latitude harus berupa angka antara -90 dan 90')
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
      return errorResponse('Longitude harus berupa angka antara -180 dan 180')
    }

    const createData: any = {
      nama,
      tipe,
      kecamatanId,
      kodeDesa,
      latitude: lat,
      longitude: lng,
    }

    const data = await prisma.desaKelurahan.create({ data: createData })
    return createdResponse(data, 'Desa/kelurahan berhasil ditambahkan')
  } catch {
    return serverErrorResponse()
  }
}
