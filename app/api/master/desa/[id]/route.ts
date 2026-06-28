import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { desaSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const body = await request.json()
    const nama = body.nama?.trim()
    if (!nama) return errorResponse('Nama desa/kelurahan wajib diisi')

    const existing = await prisma.desaKelurahan.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Desa/kelurahan tidak ditemukan')

    const duplicate = await prisma.desaKelurahan.findFirst({ where: { nama, NOT: { id } } })
    if (duplicate) return errorResponse('Desa/kelurahan dengan nama ini sudah ada')

    const updateData: any = { nama }
    if (body.tipe) updateData.tipe = body.tipe
    if (body.kecamatanId) updateData.kecamatanId = body.kecamatanId
    if (body.kodeDesa !== undefined) updateData.kodeDesa = body.kodeDesa
    if (body.latitude != null) updateData.latitude = body.latitude
    if (body.longitude != null) updateData.longitude = body.longitude

    const data = await prisma.desaKelurahan.update({ where: { id }, data: updateData })
    return successResponse(data, 'Desa/kelurahan berhasil diperbarui')
  } catch {
    return serverErrorResponse()
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const existing = await prisma.desaKelurahan.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Desa/kelurahan tidak ditemukan')

    const hasUsers = await prisma.user.findFirst({ where: { desaKelurahanId: id } })
    const hasSinyal = await prisma.riwayatSinyal.findFirst({ where: { desaKelurahanId: id } })
    if (hasUsers || hasSinyal) return errorResponse('Desa/kelurahan tidak dapat dihapus karena masih memiliki data terkait')

    await prisma.desaKelurahan.delete({ where: { id } })
    return successResponse(null, 'Desa/kelurahan berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
