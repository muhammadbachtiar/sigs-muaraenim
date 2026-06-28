import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

async function main() {
  console.log('🌱 Seeding database...')

  // Seed Super Admin
  const username = process.env.SUPER_ADMIN_USERNAME || 'admin'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'admin123'
  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      password: hashedPassword,
      nama: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  })
  console.log(`✅ Super Admin: ${username}`)

  // Seed Operator
  const operators = ['Telkomsel', 'Indosat Ooredoo', 'XL Axiata', 'Tri', 'Smartfren']
  for (const nama of operators) {
    await prisma.operator.upsert({
      where: { nama },
      update: {},
      create: { nama },
    })
  }
  console.log(`✅ Operator: ${operators.join(', ')}`)

  // Seed Teknologi
  const teknologis = ['2G', '3G', '4G LTE', '5G']
  for (const nama of teknologis) {
    await prisma.teknologi.upsert({
      where: { nama },
      update: {},
      create: { nama },
    })
  }
  console.log(`✅ Teknologi: ${teknologis.join(', ')}`)

  // Seed Media Transmisi
  const mediaList = ['Fiber Optic', 'Radio', 'VSAT']
  for (const nama of mediaList) {
    await prisma.mediaTransmisi.upsert({
      where: { nama },
      update: {},
      create: { nama },
    })
  }
  console.log(`✅ Media Transmisi: ${mediaList.join(', ')}`)

  console.log('🎉 Seeding selesai!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding gagal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
