import { prisma } from '@/lib/prisma'
import { requireAuth, createdResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const MAX_SIZE_BYTES = 3 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const towerId = formData.get('tower_id')
    const keterangan = formData.get('keterangan') as string | null

    if (!file) return errorResponse('File wajib diupload')
    if (!towerId) return errorResponse('tower_id wajib diisi')

    const tower = await prisma.tower.findUnique({ where: { id: parseInt(towerId as string, 10) } })
    if (!tower) return errorResponse('Data tower tidak ditemukan')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) return errorResponse('Format file tidak didukung (JPEG, PNG, WebP)')

    const buffer = Buffer.from(await file.arrayBuffer())

    let processedBuffer = buffer
    if (buffer.length > MAX_SIZE_BYTES) {
      processedBuffer = await sharp(buffer).resize(1920, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'tower')
    await mkdir(uploadDir, { recursive: true })

    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg'
    const filename = `tower_${towerId}_${Date.now()}${ext}`
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, processedBuffer)

    const url = `/uploads/tower/${filename}`
    const foto = await prisma.fotoTower.create({
      data: { towerId: parseInt(towerId as string, 10), userId: user!.id, url, keterangan: keterangan || null },
    })

    return createdResponse(foto, 'Foto tower berhasil diupload')
  } catch {
    return serverErrorResponse()
  }
}
