import { prisma } from '@/lib/prisma'
import { requireAuth, createdResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const MAX_SIZE_BYTES = 3 * 1024 * 1024 // 3MB limit before compression

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const formData = await request.formData()
    const towerId = formData.get('tower_id') as string | null
    const keterangan = formData.get('keterangan') as string | null

    if (!towerId) return errorResponse('tower_id wajib diisi')

    const tower = await prisma.tower.findUnique({ where: { id: towerId } })
    if (!tower) return errorResponse('Data tower tidak ditemukan')

    // Support both single 'file' or multiple 'files' in formData
    let files = formData.getAll('files') as File[]
    if (files.length === 0) {
      const singleFile = formData.get('file') as File | null
      if (singleFile) files = [singleFile]
    }

    if (files.length === 0) return errorResponse('Minimal 1 file foto wajib diupload')

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const uploadDir = path.join(process.cwd(), 'uploads', 'tower')
    await mkdir(uploadDir, { recursive: true })

    const createdPhotos = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Verification of file type
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        return errorResponse(`Format file "${file.name}" tidak didukung. Gunakan JPEG, PNG, atau WebP.`)
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      // Auto-minimize / compress if exceeding 3MB
      let processedBuffer: Buffer<any> = buffer
      if (buffer.length > MAX_SIZE_BYTES) {
        processedBuffer = await sharp(buffer)
          .resize(1920, null, { withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
      }

      const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg'
      const filename = `tower_${towerId}_${Date.now()}_${i + 1}${ext}`
      const filepath = path.join(uploadDir, filename)
      await writeFile(filepath, processedBuffer)

      const url = `/uploads/tower/${filename}`
      const foto = await prisma.fotoTower.create({
        data: {
          towerId,
          userId: user!.id,
          url,
          keterangan: keterangan || file.name || null,
        },
      })
      createdPhotos.push(foto)
    }

    return createdResponse(createdPhotos, `${createdPhotos.length} foto tower berhasil diupload`)
  } catch (err) {
    console.error('Error uploading tower photos:', err)
    return serverErrorResponse()
  }
}
