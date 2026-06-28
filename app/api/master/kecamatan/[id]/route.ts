import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { kecamatanSchema } from '@/lib/validations'

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
    if (!nama) return errorResponse('Nama kecamatan wajib diisi')

    const existing = await prisma.kecamatan.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Kecamatan tidak ditemukan')

    const duplicate = await prisma.kecamatan.findFirst({ where: { nama, NOT: { id } } })
    if (duplicate) return errorResponse('Kecamatan dengan nama ini sudah ada')

    const updateData: any = { nama }
    if (body.kode?.trim()) updateData.kode = body.kode.trim()

    const data = await prisma.kecamatan.update({ where: { id }, data: updateData })
    return successResponse(data, 'Kecamatan berhasil diperbarui')
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

    const existing = await prisma.kecamatan.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Kecamatan tidak ditemukan')

    const hasChildren = await prisma.desaKelurahan.findFirst({ where: { kecamatanId: id } })
    if (hasChildren) return errorResponse('Kecamatan tidak dapat dihapus karena masih memiliki data desa/kelurahan')

    await prisma.kecamatan.delete({ where: { id } })
    return successResponse(null, 'Kecamatan berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
