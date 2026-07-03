import 'dotenv/config'
import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function check() {
  const users = await prisma.user.findMany()

  console.log("Daftar User di DB:")
  console.log(users.map(u => ({ id: u.id, username: u.username, password: u.password, isActive: u.isActive, role: u.role })))

  const adminUser = users.find(u => u.username === 'admin')
  if (adminUser) {
    const isPassOk = await bcrypt.compare('Kominfo@1234', adminUser.password)
    console.log(`\nVerifikasi Admin ('Kominfo@1234'): ${isPassOk}`)
    
    const isPassFallbackOk = await bcrypt.compare('admin123', adminUser.password)
    console.log(`Verifikasi Admin ('admin123'): ${isPassFallbackOk}`)
  } else {
    console.log("\nAdmin user tidak ditemukan!")
  }

  await prisma.$disconnect()
}

check().catch(console.error)
