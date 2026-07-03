import { prisma } from '@/lib/prisma'
import { requireAuth, createdResponse, errorResponse, serverErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const MAX_SIZE_BYTES = 3 * 1024 * 1024 // 3MB

export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sinyalId = formData.get('sinyal_id')
    const keterangan = formData.get('keterangan') as string | null

    if (!file) return errorResponse('File wajib diupload')
    if (!sinyalId) return errorResponse('sinyal_id wajib diisi')

    const sinyal = await prisma.riwayatSinyal.findUnique({ where: { id: sinyalId as string } })
    if (!sinyal) return errorResponse('Data sinyal tidak ditemukan')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) return errorResponse('Format file tidak didukung (JPEG, PNG, WebP)')

    const buffer = Buffer.from(await file.arrayBuffer())

    // Compress if > 3MB
    let processedBuffer: Buffer<any> = buffer
    if (buffer.length > MAX_SIZE_BYTES) {
      processedBuffer = await sharp(buffer).resize(1920, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'sinyal')
    await mkdir(uploadDir, { recursive: true })

    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg'
    const filename = `sinyal_${sinyalId}_${Date.now()}${ext}`
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, processedBuffer)

    const url = `/uploads/sinyal/${filename}`
    const foto = await prisma.fotoSinyal.create({
      data: { sinyalId: sinyalId as string, userId: user!.id, url, keterangan: keterangan || null },
    })

    return createdResponse(foto, 'Foto sinyal berhasil diupload')
  } catch {
    return serverErrorResponse()
  }
}
