import { prisma } from '@/lib/prisma'
import { requireAuth, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const kecamatanId = params.get('kecamatan_id')

    const where: any = {}
    if (kecamatanId) where.kecamatanId = parseInt(kecamatanId, 10)

    const data = await prisma.desaKelurahan.findMany({
      where,
      orderBy: { nama: 'asc' },
      include: {
        kecamatan: { select: { nama: true } },
        demografi: true,
      },
    })

    const header = 'ID,Nama,Tipe,Kode Desa,Kecamatan,Latitude,Longitude,Jumlah Penduduk,Usia Produktif,Kepadatan\n'
    const rows = data.map((d) =>
      `${d.id},"${d.nama}","${d.tipe}","${d.kodeDesa ?? ''}","${d.kecamatan.nama}",${d.latitude ?? ''},${d.longitude ?? ''},${d.demografi?.jumlahPenduduk ?? ''},${d.demografi?.usiaProduktif ?? ''},${d.demografi?.kepadatan ?? ''}`
    ).join('\n')

    return new NextResponse(header + rows, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export_desa.csv"' },
    })
  } catch {
    return serverErrorResponse()
  }
}
