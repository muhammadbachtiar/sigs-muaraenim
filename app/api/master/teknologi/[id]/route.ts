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

    const existing = await prisma.teknologi.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Teknologi tidak ditemukan')

    const duplicate = await prisma.teknologi.findFirst({ where: { nama: parsed.data.nama.trim(), NOT: { id } } })
    if (duplicate) return errorResponse('Teknologi dengan nama ini sudah ada')

    const data = await prisma.teknologi.update({ where: { id }, data: { nama: parsed.data.nama.trim() } })
    return successResponse(data, 'Teknologi berhasil diperbarui')
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

    const existing = await prisma.teknologi.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Teknologi tidak ditemukan')

    const hasRelations = await prisma.towerTeknologi.findFirst({ where: { teknologiId: id } })
    const hasSinyal = await prisma.riwayatSinyal.findFirst({ where: { teknologiId: id } })
    if (hasRelations || hasSinyal) return errorResponse('Teknologi tidak dapat dihapus karena masih digunakan')

    await prisma.teknologi.delete({ where: { id } })
    return successResponse(null, 'Teknologi berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
