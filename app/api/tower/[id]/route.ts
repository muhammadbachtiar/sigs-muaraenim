import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { towerSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const data = await prisma.tower.findUnique({
      where: { id },
      include: {
        kecamatan: { select: { id: true, nama: true } },
        desaKelurahan: { select: { id: true, nama: true } },
        user: { select: { id: true, nama: true } },
        towerOperator: { include: { operator: { select: { id: true, nama: true } } } },
        towerTeknologi: { include: { teknologi: { select: { id: true, nama: true } } } },
        towerMedia: { include: { mediaTransmisi: { select: { id: true, nama: true } } } },
        foto: { select: { id: true, url: true, keterangan: true, createdAt: true } },
      },
    })

    if (!data) return notFoundResponse('Tower tidak ditemukan')
    return successResponse(data, 'Detail tower berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const existing = await prisma.tower.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Tower tidak ditemukan')

    if (user!.role === 'PEMDES' && existing.userId !== user!.id) {
      return errorResponse('Anda tidak memiliki akses untuk mengubah tower ini')
    }

    const body = await request.json()
    const parsed = towerSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const { operatorIds, teknologiIds, mediaIds, ...towerData } = parsed.data

    // Re-submit to PENDING if PEMDES edits a REJECTED tower
    const newStatus = user!.role === 'PEMDES' && existing.statusVerifikasi === 'REJECTED' ? 'PENDING' : existing.statusVerifikasi

    const data = await prisma.tower.update({
      where: { id },
      data: {
        ...towerData,
        statusVerifikasi: newStatus,
        alasanPenolakan: newStatus === 'PENDING' ? null : existing.alasanPenolakan,
        towerOperator: { deleteMany: {}, create: operatorIds.map((operatorId) => ({ operatorId })) },
        towerTeknologi: { deleteMany: {}, create: teknologiIds.map((teknologiId) => ({ teknologiId })) },
        towerMedia: { deleteMany: {}, create: mediaIds.map((mediaTransmisiId) => ({ mediaTransmisiId })) },
      },
    })

    return successResponse(data, 'Tower berhasil diperbarui')
  } catch {
    return serverErrorResponse()
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const existing = await prisma.tower.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Tower tidak ditemukan')

    if (user!.role === 'PEMDES' && existing.userId !== user!.id) {
      return errorResponse('Anda tidak memiliki akses untuk menghapus tower ini')
    }

    await prisma.tower.delete({ where: { id } })
    return successResponse(null, 'Tower berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
