import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { desaSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth(['SUPER_ADMIN'])
    if (error) return error

    const { id: idStr } = await params
    const id = parseId(idStr)
    if (!id) return errorResponse('ID tidak valid')

    const body = await request.json()
    const nama = body.nama?.trim()
    if (!nama) return errorResponse('Nama desa/kelurahan wajib diisi')

    const existing = await prisma.desaKelurahan.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Desa/kelurahan tidak ditemukan')

    const duplicate = await prisma.desaKelurahan.findFirst({ where: { nama, NOT: { id } } })
    if (duplicate) return errorResponse('Desa/kelurahan dengan nama ini sudah ada')

    const tipe = body.tipe
    if (!tipe || (tipe !== 'DESA' && tipe !== 'KELURAHAN')) {
      return errorResponse('Tipe wajib dipilih (DESA atau KELURAHAN)')
    }

    const kecamatanId = body.kecamatanId
    if (!kecamatanId) return errorResponse('Kecamatan wajib dipilih')

    const kecamatan = await prisma.kecamatan.findUnique({ where: { id: kecamatanId } })
    if (!kecamatan) return errorResponse('Kecamatan tidak ditemukan')

    const kodeDesa = body.kodeDesa?.trim() || null
    if (kodeDesa) {
      const duplicateKode = await prisma.desaKelurahan.findFirst({
        where: { kodeDesa, NOT: { id } }
      })
      if (duplicateKode) return errorResponse('Desa/kelurahan dengan kode ini sudah ada')
    }

    const lat = body.latitude != null ? parseFloat(body.latitude) : null
    const lng = body.longitude != null ? parseFloat(body.longitude) : null
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
      return errorResponse('Latitude harus berupa angka antara -90 dan 90')
    }
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
      return errorResponse('Longitude harus berupa angka antara -180 dan 180')
    }

    const updateData = {
      nama,
      tipe,
      kecamatanId,
      kodeDesa,
      latitude: lat,
      longitude: lng,
    }

    const data = await prisma.desaKelurahan.update({ where: { id }, data: updateData })
    return successResponse(data, 'Desa/kelurahan berhasil diperbarui')
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

    const existing = await prisma.desaKelurahan.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Desa/kelurahan tidak ditemukan')

    const hasUsers = await prisma.user.findFirst({ where: { desaKelurahanId: id } })
    const hasSinyal = await prisma.riwayatSinyal.findFirst({ where: { desaKelurahanId: id } })
    if (hasUsers || hasSinyal) return errorResponse('Desa/kelurahan tidak dapat dihapus karena masih memiliki data terkait')

    await prisma.desaKelurahan.delete({ where: { id } })
    return successResponse(null, 'Desa/kelurahan berhasil dihapus')
  } catch {
    return serverErrorResponse()
  }
}
