import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const profileSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi').optional(),
  password_lama: z.string().optional(),
  password_baru: z.string().min(6, 'Password baru minimal 6 karakter').optional(),
})

export async function PUT(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const parsed = profileSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const { nama, password_lama, password_baru } = parsed.data
    const updateData: any = {}

    if (nama) updateData.nama = nama

    if (password_baru) {
      if (!password_lama) return errorResponse('Password lama wajib diisi untuk mengubah password')

      const currentUser = await prisma.user.findUnique({ where: { id: user!.id } })
      if (!currentUser) return errorResponse('User tidak ditemukan')

      const isValid = await bcrypt.compare(password_lama, currentUser.password)
      if (!isValid) return errorResponse('Password lama tidak sesuai')

      updateData.password = await bcrypt.hash(password_baru, 12)
    }

    if (Object.keys(updateData).length === 0) return errorResponse('Tidak ada data yang diubah')

    const updated = await prisma.user.update({
      where: { id: user!.id },
      select: { id: true, username: true, nama: true, role: true },
      data: updateData,
    })

    return successResponse(updated, 'Profil berhasil diperbarui')
  } catch {
    return serverErrorResponse()
  }
}
