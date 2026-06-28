import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { demografiSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ desaId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { desaId: idStr } = await params
    const desaId = parseId(idStr)
    if (!desaId) return errorResponse('ID desa tidak valid')

    const data = await prisma.demografiDesa.findUnique({
      where: { desaKelurahanId: desaId },
      include: { desaKelurahan: { select: { id: true, nama: true, kecamatan: { select: { nama: true } } } } },
    })

    if (!data) return notFoundResponse('Data demografi belum diisi untuk desa ini')
    return successResponse(data, 'Data demografi berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { desaId: idStr } = await params
    const desaId = parseId(idStr)
    if (!desaId) return errorResponse('ID desa tidak valid')

    const desa = await prisma.desaKelurahan.findUnique({ where: { id: desaId } })
    if (!desa) return notFoundResponse('Desa tidak ditemukan')

    // PEMDES hanya bisa update desanya sendiri
    if (user!.role === 'PEMDES' && user!.desaKelurahanId !== desaId) {
      return errorResponse('Anda hanya dapat mengubah data demografi desa Anda')
    }

    const body = await request.json()
    const parsed = demografiSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const data = await prisma.demografiDesa.upsert({
      where: { desaKelurahanId: desaId },
      update: parsed.data,
      create: { desaKelurahanId: desaId, ...parsed.data },
    })

    return successResponse(data, 'Data demografi berhasil diperbarui')
  } catch {
    return serverErrorResponse()
  }
}
