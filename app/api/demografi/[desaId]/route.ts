import { prisma } from '@/lib/prisma'
import { requireAuth, successResponse, errorResponse, notFoundResponse, serverErrorResponse, parseId } from '@/lib/api-helpers'
import { demografiSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ desaId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { desaId: idStr } = await params
    const desaId = parseId(idStr)
    if (!desaId) return errorResponse('ID desa tidak valid')

    const desa = await prisma.desaKelurahan.findUnique({
      where: { id: desaId },
      include: {
        kecamatan: { select: { nama: true } },
        demografi: true,
      },
    })
    if (!desa) return notFoundResponse('Desa tidak ditemukan')

    // Construct unified response containing village metadata and demographic data
    const responseData = {
      desaKelurahanId: desa.id,
      jumlahPenduduk: desa.demografi?.jumlahPenduduk ?? null,
      usiaProduktif: desa.demografi?.usiaProduktif ?? null,
      kepadatan: desa.demografi?.kepadatan ?? null,
      mataPencaharianUtama: desa.demografi?.mataPencaharianUtama ?? null,
      rataRataPenghasilan: desa.demografi?.rataRataPenghasilan ?? null,
      saranaKesehatan: desa.demografi?.saranaKesehatan ?? false,
      saranaPendidikan: desa.demografi?.saranaPendidikan ?? false,
      pasar: desa.demografi?.pasar ?? false,
      kegiatanEkonomi: desa.demografi?.kegiatanEkonomi ?? null,
      catatan: desa.demografi?.catatan ?? null,
      updatedAt: desa.demografi?.updatedAt ?? null,
      desaKelurahan: {
        id: desa.id,
        nama: desa.nama,
        tipe: desa.tipe,
        kodeDesa: desa.kodeDesa,
        latitude: desa.latitude,
        longitude: desa.longitude,
        kecamatan: {
          nama: desa.kecamatan.nama,
        },
      },
    }

    return successResponse(responseData, 'Data demografi berhasil diambil')
  } catch {
    return serverErrorResponse()
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const { desaId: idStr } = await params
    const desaId = parseId(idStr)
    if (!desaId) return errorResponse('ID desa tidak valid')

    const desa = await prisma.desaKelurahan.findUnique({ where: { id: desaId } })
    if (!desa) return notFoundResponse('Desa tidak ditemukan')

    // PEMDES hanya bisa update desanya sendiri
    if (user!.role === 'PEMDES' && user!.desaKelurahanId !== desaId) {
      return errorResponse('Anda hanya dapat mengubah data demografi desa Anda')
    }

    const body = await request.json()

    // Extract coordinates if provided
    const latitude = body.latitude != null ? parseFloat(body.latitude) : undefined
    const longitude = body.longitude != null ? parseFloat(body.longitude) : undefined

    if (latitude !== undefined && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
      return errorResponse('Latitude harus berupa angka antara -90 dan 90')
    }
    if (longitude !== undefined && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
      return errorResponse('Longitude harus berupa angka antara -180 dan 180')
    }

    // Strip out coordinates from demographics schema validation
    const demografiBody = { ...body }
    delete demografiBody.latitude
    delete demografiBody.longitude

    const parsed = demografiSchema.safeParse(demografiBody)
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message)

    // Update village coordinates if provided
    if (latitude !== undefined || longitude !== undefined) {
      const desaUpdateData: any = {}
      if (latitude !== undefined) desaUpdateData.latitude = latitude
      if (longitude !== undefined) desaUpdateData.longitude = longitude

      await prisma.desaKelurahan.update({
        where: { id: desaId },
        data: desaUpdateData,
      })
    }

    const data = await prisma.demografiDesa.upsert({
      where: { desaKelurahanId: desaId },
      update: parsed.data,
      create: { desaKelurahanId: desaId, ...parsed.data },
    })

    return successResponse(data, 'Data demografi berhasil diperbarui')
  } catch {
    return serverErrorResponse()
  }
}
