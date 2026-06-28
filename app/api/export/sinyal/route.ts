import { prisma } from '@/lib/prisma'
import { requireAuth, errorResponse, serverErrorResponse, parseSearchParams } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth()
    if (error) return error

    const params = parseSearchParams(request)
    const desaFilter = user!.role === 'PEMDES' && user!.desaKelurahanId ? { desaKelurahanId: user!.desaKelurahanId } : {}
    const operatorId = params.get('operator_id')

    const where: any = { ...desaFilter }
    if (operatorId) where.operatorId = parseInt(operatorId, 10)

    const data = await prisma.riwayatSinyal.findMany({
      where,
      orderBy: { tanggalPengukuran: 'desc' },
      include: {
        operator: { select: { nama: true } },
        teknologi: { select: { nama: true } },
        desaKelurahan: { select: { nama: true, kecamatan: { select: { nama: true } } } },
        user: { select: { nama: true } },
      },
    })

    const header = 'ID,Latitude,Longitude,RSRP,RSSI,RSRQ,SNR,Operator,Teknologi,Desa,Kecamatan,Tanggal,Petugas,Catatan\n'
    const rows = data.map((d) =>
      `${d.id},${d.latitude},${d.longitude},${d.rsrp ?? ''},${d.rssi ?? ''},${d.rsrq ?? ''},${d.snr ?? ''},"${d.operator.nama}","${d.teknologi.nama}","${d.desaKelurahan.nama}","${d.desaKelurahan.kecamatan.nama}","${d.tanggalPengukuran.toISOString()}","${d.user.nama}","${d.catatan ?? ''}"`
    ).join('\n')

    return new NextResponse(header + rows, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export_sinyal.csv"' },
    })
  } catch {
    return serverErrorResponse()
  }
}
