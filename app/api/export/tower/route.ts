import { prisma } from '@/lib/prisma'
import { requireAuth, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const statusVerifikasi = params.get('status_verifikasi')
    const kecamatanId = params.get('kecamatan_id')

    const where: any = {}
    if (statusVerifikasi) where.statusVerifikasi = statusVerifikasi
    if (kecamatanId) where.kecamatanId = parseInt(kecamatanId, 10)

    const data = await prisma.tower.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        kecamatan: { select: { nama: true } },
        desaKelurahan: { select: { nama: true } },
        user: { select: { nama: true } },
        towerOperator: { include: { operator: { select: { nama: true } } } },
        towerTeknologi: { include: { teknologi: { select: { nama: true } } } },
        towerMedia: { include: { mediaTransmisi: { select: { nama: true } } } },
      },
    })

    const header = 'ID,Nama Tower,Latitude,Longitude,Tinggi,Status,Kecamatan,Desa,Operator,Teknologi,Media,Petugas,Tanggal\n'
    const rows = data.map((d) => {
      const ops = d.towerOperator.map((o) => o.operator.nama).join('; ')
      const teks = d.towerTeknologi.map((t) => t.teknologi.nama).join('; ')
      const meds = d.towerMedia.map((m) => m.mediaTransmisi.nama).join('; ')
      return `${d.id},"${d.namaTower}",${d.latitude},${d.longitude},"${d.tinggiKategori ?? ''}","${d.statusVerifikasi}","${d.kecamatan.nama}","${d.desaKelurahan?.nama ?? ''}","${ops}","${teks}","${meds}","${d.user.nama}","${d.createdAt.toISOString()}"`
    }).join('\n')

    return new NextResponse(header + rows, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export_tower.csv"' },
    })
  } catch {
    return serverErrorResponse()
  }
}
