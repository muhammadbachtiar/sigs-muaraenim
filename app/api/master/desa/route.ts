import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { desaSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take, search } = parsePagination(params)
    const kecamatanId = params.get('kecamatan_id')

    const where: any = {}
    if (search) where.nama = { contains: search, mode: 'insensitive' }
    if (kecamatanId) where.kecamatanId = parseInt(kecamatanId, 10)

    const [data, total] = await Promise.all([
      prisma.desaKelurahan.findMany({
        where,
        skip,
        take,
        orderBy: { nama: 'asc' },
        include: { kecamatan: { select: { id: true, nama: true } } },
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

    const tipe = body.tipe || 'DESA'
    const kecamatanId = body.kecamatanId

    // If kecamatanId is provided, validate it
    if (kecamatanId) {
      const kecamatan = await prisma.kecamatan.findUnique({ where: { id: kecamatanId } })
      if (!kecamatan) return errorResponse('Kecamatan tidak ditemukan')
    }

    // Check duplicate name
    const existingNama = await prisma.desaKelurahan.findFirst({ where: { nama } })
    if (existingNama) return errorResponse('Desa/kelurahan dengan nama ini sudah ada')

    const createData: any = { nama, tipe }
    if (kecamatanId) createData.kecamatanId = kecamatanId
    if (body.kodeDesa) createData.kodeDesa = body.kodeDesa
    if (body.latitude != null) createData.latitude = body.latitude
    if (body.longitude != null) createData.longitude = body.longitude

    const data = await prisma.desaKelurahan.create({ data: createData })
    return createdResponse(data, 'Desa/kelurahan berhasil ditambahkan')
  } catch {
    return serverErrorResponse()
  }
}
