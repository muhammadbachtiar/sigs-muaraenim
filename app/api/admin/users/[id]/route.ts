import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

const updateUserSchema = z.object({
  nama: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  desaKelurahanId: z.number().int().positive().optional(),
})

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const body = await request.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('User tidak ditemukan')
    if (existing.role === 'SUPER_ADMIN') return errorResponse('Tidak dapat mengubah akun Super Admin')

    const data = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, username: true, nama: true, role: true, isActive: true, desaKelurahanId: true },
    })

    return successResponse(data, 'Akun berhasil diperbarui')
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

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('User tidak ditemukan')
    if (existing.role === 'SUPER_ADMIN') return errorResponse('Tidak dapat menonaktifkan akun Super Admin')

    const data = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, username: true, nama: true, isActive: true },
    })

    return successResponse(data, 'Akun berhasil dinonaktifkan')
  } catch {
    return serverErrorResponse()
  }
}
