import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updateProfileSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi').optional(),
  username: z.string().min(3, 'Username minimal 3 karakter').optional(),
  oldPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter').optional(),
}).refine(data => {
  if (data.newPassword && !data.oldPassword) {
    return false
  }
  return true
}, {
  message: 'Password lama wajib diisi untuk mengubah password',
  path: ['oldPassword']
})

export async function GET() {
  try {
    const { user: authUser, error } = await requireAuth()
    if (error) return error

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        username: true,
        nama: true,
        role: true,
        createdAt: true,
        desaKelurahan: {
          select: {
            nama: true,
            kecamatan: {
              select: {
                nama: true
              }
            }
          }
        }
      }
    })

    if (!dbUser) return errorResponse('User tidak ditemukan', 404)

    return successResponse(dbUser, 'Data profil berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}

export async function PUT(request: Request) {
  try {
    const { user: authUser, error } = await requireAuth()
    if (error) return error

    const body = await request.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message)
    }

    const { nama, username, oldPassword, newPassword } = parsed.data

    // Fetch user from DB to verify password or check existing username
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id }
    })
    if (!dbUser) return errorResponse('User tidak ditemukan', 404)

    const updateData: any = {}

    // 1. Handle username change
    if (username && username !== dbUser.username) {
      const formattedUsername = username.trim().toLowerCase().replace(/\s+/g, '')
      if (formattedUsername.length < 3) {
        return errorResponse('Username minimal 3 karakter')
      }
      const existingUser = await prisma.user.findUnique({
        where: { username: formattedUsername }
      })
      if (existingUser) {
        return errorResponse('Username tidak tersedia')
      }
      updateData.username = formattedUsername
    }

    // 2. Handle name change
    if (nama) {
      updateData.nama = nama.trim()
    }

    // 3. Handle password change
    if (newPassword) {
      if (!oldPassword) {
        return errorResponse('Password lama wajib diisi')
      }
      const isPasswordValid = await bcrypt.compare(oldPassword, dbUser.password)
      if (!isPasswordValid) {
        return errorResponse('Password lama salah')
      }
      updateData.password = await bcrypt.hash(newPassword, 12)
    }

    // If nothing to update
    if (Object.keys(updateData).length === 0) {
      return errorResponse('Tidak ada data yang diubah')
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        nama: true,
        role: true
      }
    })

    return successResponse(updatedUser, 'Profil berhasil diperbarui')
  } catch {
    return serverErrorResponse()
  }
}
