'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ─── Types ───
export type ActionResult = {
  success: boolean
  message: string
  data?: unknown
}

// ─── Operator CRUD ───

export async function getOperators(): Promise<ActionResult> {
  try {
    const data = await prisma.operator.findMany({ orderBy: { id: 'asc' } })
    return { success: true, message: '', data }
  } catch (error) {
    return { success: false, message: 'Gagal memuat data operator' }
  }
}

export async function createOperator(nama: string): Promise<ActionResult> {
  try {
    if (!nama.trim()) return { success: false, message: 'Nama operator wajib diisi' }
    const existing = await prisma.operator.findUnique({ where: { nama: nama.trim() } })
    if (existing) return { success: false, message: 'Operator dengan nama ini sudah ada' }
    await prisma.operator.create({ data: { nama: nama.trim() } })
    revalidatePath('/')
    return { success: true, message: 'Operator berhasil ditambahkan' }
  } catch (error) {
    return { success: false, message: 'Gagal menambahkan operator' }
  }
}

export async function updateOperator(id: string, nama: string): Promise<ActionResult> {
  try {
    if (!nama.trim()) return { success: false, message: 'Nama operator wajib diisi' }
    const existing = await prisma.operator.findFirst({
      where: { nama: nama.trim(), NOT: { id } },
    })
    if (existing) return { success: false, message: 'Operator dengan nama ini sudah ada' }
    await prisma.operator.update({ where: { id }, data: { nama: nama.trim() } })
    revalidatePath('/')
    return { success: true, message: 'Operator berhasil diperbarui' }
  } catch (error) {
    return { success: false, message: 'Gagal memperbarui operator' }
  }
}

export async function deleteOperator(id: string): Promise<ActionResult> {
  try {
    const hasRelations = await prisma.towerOperator.findFirst({ where: { operatorId: id } })
    const hasSignal = await prisma.riwayatSinyal.findFirst({ where: { operatorId: id } })
    if (hasRelations || hasSignal) {
      return { success: false, message: 'Operator tidak dapat dihapus karena masih digunakan di data tower atau sinyal' }
    }
    await prisma.operator.delete({ where: { id } })
    revalidatePath('/')
    return { success: true, message: 'Operator berhasil dihapus' }
  } catch (error) {
    return { success: false, message: 'Gagal menghapus operator' }
  }
}

// ─── Teknologi CRUD ───

export async function getTeknologis(): Promise<ActionResult> {
  try {
    const data = await prisma.teknologi.findMany({ orderBy: { id: 'asc' } })
    return { success: true, message: '', data }
  } catch (error) {
    return { success: false, message: 'Gagal memuat data teknologi' }
  }
}

export async function createTeknologi(nama: string): Promise<ActionResult> {
  try {
    if (!nama.trim()) return { success: false, message: 'Nama teknologi wajib diisi' }
    const existing = await prisma.teknologi.findUnique({ where: { nama: nama.trim() } })
    if (existing) return { success: false, message: 'Teknologi dengan nama ini sudah ada' }
    await prisma.teknologi.create({ data: { nama: nama.trim() } })
    revalidatePath('/')
    return { success: true, message: 'Teknologi berhasil ditambahkan' }
  } catch (error) {
    return { success: false, message: 'Gagal menambahkan teknologi' }
  }
}

export async function updateTeknologi(id: string, nama: string): Promise<ActionResult> {
  try {
    if (!nama.trim()) return { success: false, message: 'Nama teknologi wajib diisi' }
    const existing = await prisma.teknologi.findFirst({
      where: { nama: nama.trim(), NOT: { id } },
    })
    if (existing) return { success: false, message: 'Teknologi dengan nama ini sudah ada' }
    await prisma.teknologi.update({ where: { id }, data: { nama: nama.trim() } })
    revalidatePath('/')
    return { success: true, message: 'Teknologi berhasil diperbarui' }
  } catch (error) {
    return { success: false, message: 'Gagal memperbarui teknologi' }
  }
}

export async function deleteTeknologi(id: string): Promise<ActionResult> {
  try {
    const hasRelations = await prisma.towerTeknologi.findFirst({ where: { teknologiId: id } })
    const hasSignal = await prisma.riwayatSinyal.findFirst({ where: { teknologiId: id } })
    if (hasRelations || hasSignal) {
      return { success: false, message: 'Teknologi tidak dapat dihapus karena masih digunakan di data tower atau sinyal' }
    }
    await prisma.teknologi.delete({ where: { id } })
    revalidatePath('/')
    return { success: true, message: 'Teknologi berhasil dihapus' }
  } catch (error) {
    return { success: false, message: 'Gagal menghapus teknologi' }
  }
}

// ─── Media Transmisi CRUD ───

export async function getMediaTransmisis(): Promise<ActionResult> {
  try {
    const data = await prisma.mediaTransmisi.findMany({ orderBy: { id: 'asc' } })
    return { success: true, message: '', data }
  } catch (error) {
    return { success: false, message: 'Gagal memuat data media transmisi' }
  }
}

export async function createMediaTransmisi(nama: string): Promise<ActionResult> {
  try {
    if (!nama.trim()) return { success: false, message: 'Nama media transmisi wajib diisi' }
    const existing = await prisma.mediaTransmisi.findUnique({ where: { nama: nama.trim() } })
    if (existing) return { success: false, message: 'Media transmisi dengan nama ini sudah ada' }
    await prisma.mediaTransmisi.create({ data: { nama: nama.trim() } })
    revalidatePath('/')
    return { success: true, message: 'Media transmisi berhasil ditambahkan' }
  } catch (error) {
    return { success: false, message: 'Gagal menambahkan media transmisi' }
  }
}

export async function updateMediaTransmisi(id: string, nama: string): Promise<ActionResult> {
  try {
    if (!nama.trim()) return { success: false, message: 'Nama media transmisi wajib diisi' }
    const existing = await prisma.mediaTransmisi.findFirst({
      where: { nama: nama.trim(), NOT: { id } },
    })
    if (existing) return { success: false, message: 'Media transmisi dengan nama ini sudah ada' }
    await prisma.mediaTransmisi.update({ where: { id }, data: { nama: nama.trim() } })
    revalidatePath('/')
    return { success: true, message: 'Media transmisi berhasil diperbarui' }
  } catch (error) {
    return { success: false, message: 'Gagal memperbarui media transmisi' }
  }
}

export async function deleteMediaTransmisi(id: string): Promise<ActionResult> {
  try {
    const hasRelations = await prisma.towerMedia.findFirst({ where: { mediaTransmisiId: id } })
    if (hasRelations) {
      return { success: false, message: 'Media transmisi tidak dapat dihapus karena masih digunakan di data tower' }
    }
    await prisma.mediaTransmisi.delete({ where: { id } })
    revalidatePath('/')
    return { success: true, message: 'Media transmisi berhasil dihapus' }
  } catch (error) {
    return { success: false, message: 'Gagal menghapus media transmisi' }
  }
}

// ─── Dashboard Stats ───

export async function getDashboardStats(): Promise<ActionResult> {
  try {
    const [
      totalSinyal,
      totalTower,
      totalOperator,
      totalTeknologi,
      totalMedia,
      sinyalBaik,
      sinyalSedang,
      sinyalBuruk,
    ] = await Promise.all([
      prisma.riwayatSinyal.count(),
      prisma.tower.count(),
      prisma.operator.count(),
      prisma.teknologi.count(),
      prisma.mediaTransmisi.count(),
      prisma.riwayatSinyal.count({ where: { rsrp: { gte: -85 } } }),
      prisma.riwayatSinyal.count({ where: { rsrp: { lt: -85, gte: -100 } } }),
      prisma.riwayatSinyal.count({ where: { rsrp: { lt: -100 } } }),
    ])

    return {
      success: true,
      message: '',
      data: {
        totalSinyal,
        totalTower,
        totalOperator,
        totalTeknologi,
        totalMedia,
        sinyalBaik,
        sinyalSedang,
        sinyalBuruk,
      },
    }
  } catch (error) {
    return { success: false, message: 'Gagal memuat statistik dashboard' }
  }
}
