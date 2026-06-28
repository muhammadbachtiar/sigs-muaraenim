import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { sinyalSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const data = await prisma.riwayatSinyal.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, nama: true } },
        teknologi: { select: { id: true, nama: true } },
        desaKelurahan: { select: { id: true, nama: true, kecamatan: { select: { id: true, nama: true } } } },
        user: { select: { id: true, nama: true } },
        foto: { select: { id: true, url: true, keterangan: true, createdAt: true } },
      },
    })

    if (!data) return notFoundResponse('Data sinyal tidak ditemukan')

    // Tenant isolation
    if (user!.role === 'PEMDES' && user!.desaKelurahanId && data.desaKelurahanId !== user!.desaKelurahanId) {
      return notFoundResponse('Data sinyal tidak ditemukan')
    }

    return successResponse(data, 'Detail sinyal berhasil diambil')
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

    const existing = await prisma.riwayatSinyal.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Data sinyal tidak ditemukan')

    // Ownership check: PEMDES hanya bisa edit miliknya
    if (user!.role === 'PEMDES' && existing.userId !== user!.id) {
      return errorResponse('Anda tidak memiliki akses untuk mengubah data ini')
    }

    const body = await request.json()
    const parsed = sinyalSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const data = await prisma.riwayatSinyal.update({
      where: { id },
      data: { ...parsed.data, tanggalPengukuran: new Date(parsed.data.tanggalPengukuran) },
    })

    return successResponse(data, 'Data sinyal berhasil diperbarui')
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

    const existing = await prisma.riwayatSinyal.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Data sinyal tidak ditemukan')

    if (user!.role === 'PEMDES' && existing.userId !== user!.id) {
      return errorResponse('Anda tidak memiliki akses untuk menghapus data ini')
    }

    await prisma.riwayatSinyal.delete({ where: { id } })
    return successResponse(null, 'Data sinyal berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
