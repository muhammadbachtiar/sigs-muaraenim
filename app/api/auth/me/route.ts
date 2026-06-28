import { requireAuth, successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const fullUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        id: true,
        username: true,
        nama: true,
        role: true,
        isActive: true,
        desaKelurahanId: true,
        desaKelurahan: { select: { id: true, nama: true, kecamatan: { select: { id: true, nama: true } } } },
        createdAt: true,
      },
    })

    if (!fullUser) return unauthorizedResponse('User tidak ditemukan')

    return successResponse(fullUser, 'Data user berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}
