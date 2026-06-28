import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { verifyTowerSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const body = await request.json()
    const parsed = verifyTowerSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const existing = await prisma.tower.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Tower tidak ditemukan')

    if (parsed.data.statusVerifikasi === 'REJECTED' && !parsed.data.alasanPenolakan) {
      return errorResponse('Alasan penolakan wajib diisi')
    }

    const data = await prisma.tower.update({
      where: { id },
      data: {
        statusVerifikasi: parsed.data.statusVerifikasi,
        alasanPenolakan: parsed.data.statusVerifikasi === 'REJECTED' ? parsed.data.alasanPenolakan : null,
      },
    })

    const statusLabel = parsed.data.statusVerifikasi === 'APPROVED' ? 'disetujui' : 'ditolak'
    return successResponse(data, `Tower berhasil ${statusLabel}`)
  } catch {
    return serverErrorResponse()
  }
}
