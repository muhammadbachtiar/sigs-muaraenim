import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { unlink } from 'fs/promises'
import path from 'path'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    // Check both foto tables
    let foto: any = await prisma.fotoSinyal.findUnique({ where: { id } })
    let type = 'sinyal'
    if (!foto) {
      foto = await prisma.fotoTower.findUnique({ where: { id } })
      type = 'tower'
    }
    if (!foto) return notFoundResponse('Foto tidak ditemukan')

    if (user!.role === 'PEMDES' && foto.userId !== user!.id) {
      return errorResponse('Anda tidak memiliki akses untuk menghapus foto ini')
    }

    // Delete file from disk
    try {
      const filepath = path.join(process.cwd(), foto.url)
      await unlink(filepath)
    } catch {
      // File might not exist, continue with DB deletion
    }

    if (type === 'sinyal') {
      await prisma.fotoSinyal.delete({ where: { id } })
    } else {
      await prisma.fotoTower.delete({ where: { id } })
    }

    return successResponse(null, 'Foto berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
