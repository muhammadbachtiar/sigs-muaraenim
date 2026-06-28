import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import { kecamatanSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take, search } = parsePagination(params)

    const where = search ? { nama: { contains: search, mode: 'insensitive' as const } } : {}

    const [data, total] = await Promise.all([
      prisma.kecamatan.findMany({ where, skip, take, orderBy: { nama: 'asc' } }),
      prisma.kecamatan.count({ where }),
    ])

    return successResponse(data, 'Data kecamatan berhasil diambil', paginationMeta(total, page, pageSize))
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
    if (!nama) return errorResponse('Nama kecamatan wajib diisi')

    const kode = body.kode?.trim() || nama.toLowerCase().replace(/\s+/g, '-')

    const existingNama = await prisma.kecamatan.findFirst({ where: { nama } })
    if (existingNama) return errorResponse('Kecamatan dengan nama ini sudah ada')

    const data = await prisma.kecamatan.create({ data: { nama, kode } })
    return createdResponse(data, 'Kecamatan berhasil ditambahkan')
  } catch {
    return serverErrorResponse()
  }
}
