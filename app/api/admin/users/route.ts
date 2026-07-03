import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, createdResponse, errorResponse, serverErrorResponse, parsePagination, paginationMeta, parseSearchParams } from '@/lib/api-helpers'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createUserSchema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter'),
  nama: z.string().min(1, 'Nama wajib diisi'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  desaKelurahanId: z.string().uuid('Desa/kelurahan wajib dipilih'),
})

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const params = parseSearchParams(request)
    const { page, pageSize, skip, take, search } = parsePagination(params)

    const where: any = { role: 'PEMDES' }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { nama: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total, totalActive, totalInactive] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, username: true, nama: true, role: true, isActive: true, createdAt: true,
          desaKelurahan: { select: { id: true, nama: true, kecamatan: { select: { id: true, nama: true } } } },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { role: 'PEMDES', isActive: true } }),
      prisma.user.count({ where: { role: 'PEMDES', isActive: false } }),
    ])

    return successResponse(data, 'Data akun Pemdes berhasil diambil', {
      ...paginationMeta(total, page, pageSize),
      totalActive,
      totalInactive,
    })
  } catch {
    return serverErrorResponse()
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } })
    if (existing) return errorResponse('Username sudah digunakan')

    const desa = await prisma.desaKelurahan.findUnique({ where: { id: parsed.data.desaKelurahanId } })
    if (!desa) return errorResponse('Desa/kelurahan tidak ditemukan')

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

    const data = await prisma.user.create({
      data: {
        username: parsed.data.username,
        nama: parsed.data.nama,
        password: hashedPassword,
        role: 'PEMDES',
        desaKelurahanId: parsed.data.desaKelurahanId,
      },
      select: { id: true, username: true, nama: true, role: true, desaKelurahanId: true },
    })

    return createdResponse(data, 'Akun Pemdes berhasil dibuat')
  } catch {
    return serverErrorResponse()
  }
}
