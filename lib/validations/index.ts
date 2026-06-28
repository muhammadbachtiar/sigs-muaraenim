import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export const sinyalSchema = z.object({
  desaKelurahanId: z.number().int().positive(),
  operatorId: z.number().int().positive(),
  teknologiId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  rsrp: z.number().nullable().optional(),
  rssi: z.number().nullable().optional(),
  rsrq: z.number().nullable().optional(),
  snr: z.number().nullable().optional(),
  tanggalPengukuran: z.string().or(z.date()),
  catatan: z.string().optional(),
})

export const towerSchema = z.object({
  desaKelurahanId: z.number().int().positive().optional(),
  kecamatanId: z.number().int().positive(),
  namaTower: z.string().min(1, 'Nama tower wajib diisi'),
  deskripsiLokasi: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tinggiKategori: z.string().optional(),
  operatorIds: z.array(z.number().int().positive()),
  teknologiIds: z.array(z.number().int().positive()),
  mediaIds: z.array(z.number().int().positive()),
})

export const bboxSchema = z.object({
  minLat: z.coerce.number().min(-90).max(90),
  maxLat: z.coerce.number().min(-90).max(90),
  minLng: z.coerce.number().min(-180).max(180),
  maxLng: z.coerce.number().min(-180).max(180),
})

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
})

export const masterDataSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi'),
})

export const kecamatanSchema = z.object({
  nama: z.string().min(1, 'Nama kecamatan wajib diisi'),
  kode: z.string().min(1, 'Kode kecamatan wajib diisi'),
})

export const desaSchema = z.object({
  kecamatanId: z.number().int().positive(),
  nama: z.string().min(1, 'Nama desa wajib diisi'),
  tipe: z.enum(['DESA', 'KELURAHAN']),
  kodeDesa: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

export const demografiSchema = z.object({
  jumlahPenduduk: z.number().int().positive().nullable().optional(),
  usiaProduktif: z.number().int().positive().nullable().optional(),
  kepadatan: z.number().nullable().optional(),
  mataPencaharianUtama: z.string().nullable().optional(),
  rataRataPenghasilan: z.number().int().nullable().optional(),
  saranaKesehatan: z.boolean().optional(),
  saranaPendidikan: z.boolean().optional(),
  pasar: z.boolean().optional(),
  kegiatanEkonomi: z.string().nullable().optional(),
  catatan: z.string().nullable().optional(),
})

export const verifyTowerSchema = z.object({
  statusVerifikasi: z.enum(['APPROVED', 'REJECTED']),
  alasanPenolakan: z.string().optional(),
})
