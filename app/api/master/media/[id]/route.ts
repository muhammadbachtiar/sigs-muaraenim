import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { masterDataSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const body = await request.json()
    const parsed = masterDataSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const existing = await prisma.mediaTransmisi.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Media transmisi tidak ditemukan')

    const duplicate = await prisma.mediaTransmisi.findFirst({ where: { nama: parsed.data.nama.trim(), NOT: { id } } })
    if (duplicate) return errorResponse('Media transmisi dengan nama ini sudah ada')

    const data = await prisma.mediaTransmisi.update({ where: { id }, data: { nama: parsed.data.nama.trim() } })
    return successResponse(data, 'Media transmisi berhasil diperbarui')
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

    const existing = await prisma.mediaTransmisi.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Media transmisi tidak ditemukan')

    const hasRelations = await prisma.towerMedia.findFirst({ where: { mediaTransmisiId: id } })
    if (hasRelations) return errorResponse('Media transmisi tidak dapat dihapus karena masih digunakan')

    await prisma.mediaTransmisi.delete({ where: { id } })
    return successResponse(null, 'Media transmisi berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
