import { Role, TipeDesa } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

async function main() {
  console.log('🌱 Memulai proses seeding database...')

  console.log('🌐 Menyiapkan PostGIS (Triggers & Spatial Indexes)...')
  const sqlPath = path.join(process.cwd(), 'prisma', 'postgis-setup.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await prisma.$executeRawUnsafe(sql)
  console.log('✅ PostGIS berhasil disiapkan.')

  const username = process.env.SUPER_ADMIN_USERNAME || 'admin'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'admin123'
  const hashedPassword = await bcrypt.hash(password, 12)
  const defaultDesaPassword = process.env.DEFAULT_DESA_PASSWORD || 'pemdes123'
  const hashedDesaPassword = await bcrypt.hash(defaultDesaPassword, 12)

  await prisma.user.upsert({
    where: { username },
    update: {
      nama: 'Super Admin',
    },
    create: {
      id: randomUUID(),
      username,
      password: hashedPassword,
      nama: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  })
  console.log(`✅ Super Admin berhasil di-seed: ${username}`)

  const operators = ['Telkomsel', 'Indosat Ooredoo', 'XL Axiata', 'Tri', 'Smartfren']
  for (const nama of operators) {
    await prisma.operator.upsert({
      where: { nama },
      update: {},
      create: {
        id: randomUUID(),
        nama,
      },
    })
  }
  console.log(`✅ Operator berhasil di-seed.`)

  const teknologis = ['2G', '3G', '4G LTE', '5G']
  for (const nama of teknologis) {
    await prisma.teknologi.upsert({
      where: { nama },
      update: {},
      create: {
        id: randomUUID(),
        nama,
      },
    })
  }
  console.log(`✅ Teknologi berhasil di-seed.`)

  const mediaList = ['Fiber Optic', 'Radio', 'VSAT']
  for (const nama of mediaList) {
    await prisma.mediaTransmisi.upsert({
      where: { nama },
      update: {},
      create: {
        id: randomUUID(),
        nama,
      },
    })
  }
  console.log(`✅ Media Transmisi berhasil di-seed.`)

  const wilayahMuaraEnim = [
    { nama: "Belida Darat", desa: ["Babat", "Gaung Asam", "Ibul", "Lubuk Getam", "Lubuk Semantung", "Sialingan", "Talang Balai", "Talang Beliung", "Tanjung Bunut", "Tanjung Tiga"], kelurahan: [] },
    { nama: "Belimbing", desa: ["Belimbing", "Belimbing Jaya", "Berugo", "Bulang", "Cinta Kasih", "Dalam", "Darmo Kasih", "Simpang Tanjung", "Tanjung", "Teluk Lubuk"], kelurahan: [] },
    { nama: "Benakat", desa: ["Betung", "Hidup Baru", "Padang Bindu", "Pagar Dewa", "Pagarjati", "Rami Pasai"], kelurahan: [] },
    { nama: "Empat Petulai Dangku", desa: ["Banuayu", "Batu Raja", "Dangku", "Gunung Raja", "Kahuripan Baru", "Kuripan", "Kuripan Selatan", "Muara Niru", "Pangkalan Babat", "Siku"], kelurahan: [] },
    { nama: "Gelumbang", desa: ["Betung", "Bitis", "Gaung Telang", "Gumai", "Jambu", "Karang Endah", "Karang Endah Selatan", "Kerta Mulia", "Midar", "Melilian", "Payabakal", "Pedataran", "Pinang Banjar", "Putak", "Sebau", "Segayam", "Sigam", "Suka Jaya", "Suka Menang", "Talang Taling", "Tambangan Kelekar", "Teluk Limau"], kelurahan: ["Gelumbang"] },
    { nama: "Gunung Megang", desa: ["Bangun Sari", "Gunung Megang Dalam", "Gunung Megang Luar", "Kayu Ara Sakti", "Lubuk Mumpo", "Pajar Indah", "Panang Jaya", "Penanggiran", "Perjito", "Sidomulyo", "Sumaja Makmur", "Tanjung Muning", "Tanjung Terang"], kelurahan: [] },
    { nama: "Kelekar", desa: ["Embacang Kelekar", "Menanti", "Menanti Selatan", "Pelempang", "Suban Baru", "Tanjung Medang", "Teluk Jaya"], kelurahan: [] },
    { nama: "Lawang Kidul", desa: ["Darmo", "Keban Agung", "Lingga", "Tegal Rejo"], kelurahan: ["Pasar Tanjung Enim", "Tanjung Enim", "Tanjung Enim Selatan"] },
    { nama: "Lembak", desa: ["Alai", "Alai Selatan", "Kemang", "Lembak", "Lubuk Enau", "Petanang", "Sungai Duren", "Talang Nangka", "Tanjung Baru", "Tapus"], kelurahan: [] },
    { nama: "Lubai", desa: ["Air Asam", "Aur", "Beringin", "Gunung Raja", "Jiwa Baru", "Kota Baru", "Menanti", "Pagar Gunung", "Suka Merindu", "Tanjung Kemala"], kelurahan: [] },
    { nama: "Lubai Ulu", desa: ["Karang Agung", "Karang Mulya", "Karang Sari", "Lecah", "Lubai Makmur", "Lubai Persada", "Mekar Jaya", "Pagar Dewa", "Prabumenang", "Sumber Asri", "Sumber Mulya"], kelurahan: [] },
    { nama: "Muara Belida", desa: ["Arisan Musi", "Arisan Musi Timur", "Gedung Buruk", "Harapan Mulia", "Kayu Ara Batu", "Mulia Abadi", "Patra Tani", "Tanjung Baru"], kelurahan: [] },
    { nama: "Muara Enim", desa: ["Harapan Jaya", "Karang Raja", "Kepur", "Lubuk Empelas", "Muara Harapan", "Muara Lawai", "Saka Jaya", "Tanjung Jati", "Tanjung Raja", "Tanjung Serian"], kelurahan: ["Air Lintang", "Muara Enim", "Pasar I", "Pasar II", "Pasar III", "Tungkal"] },
    { nama: "Panang Enim", desa: ["Bedegung", "Indramayu", "Lambur", "Lebak Budi", "Lubuk Nipis", "Muara Meo", "Padang Bindu", "Pagar Jati", "Pandan Dulang", "Sugih Waras", "Sukaraja", "Tanjung Baru"], kelurahan: [] },
    { nama: "Rambang", desa: ["Air Keruh", "Baru Rambang", "Kencana Mulia", "Marga Mulya", "Negeri Agung", "Pagar Agung", "Sugih Waras", "Sugihan", "Sugihwaras Barat", "Sukarami", "Sumber Rahayu", "Tanjung Dalam", "Tanjung Raya"], kelurahan: [] },
    { nama: "Rambang Niru", desa: ["Air Cekdam", "Air Enau", "Air Limau", "Air Talas", "Aur Duri", "Gemawang", "Gerinam", "Jemenang", "Kasih Dewa", "Lubuk Raman", "Manunggal Jaya", "Manunggal Makmur", "Muara Emburung", "Suban Jeriji", "Tanjung Menang", "Tebat Agung"], kelurahan: [] },
    { nama: "Semende Darat Laut", desa: ["Babatan", "Karya Nyata", "Muara Danau", "Muara Dua", "Pagar Agung", "Penindaian", "Penyandingan", "Perapau", "Pulau Panggung", "Tanah Abang"], kelurahan: [] },
    { nama: "Semende Darat Tengah", desa: ["Batu Surau", "Gunung Agung", "Kota Agung", "Kota Padang", "Muara Tenang", "Palak Tanah", "Rekimai Jaya", "Sri Tanjung", "Swarna Dwipa", "Tanjung Raya", "Tebing Abang", "Tenam Bungkuk"], kelurahan: [] },
    { nama: "Semende Darat Ulu", desa: ["Aremantai", "Cahaya Alam", "Danau Gerak", "Datar Lebar", "Pajar Bulan", "Pelakat", "Segamit", "Siring Agung", "Tanjung Agung", "Tanjung Tiga"], kelurahan: [] },
    { nama: "Sungai Rotan", desa: ["Danau Baru", "Danau Rata", "Danau Tampang", "Kasai", "Modong", "Muara Lematang", "Paya Angus", "Penandingan", "Petar Dalam", "Petar Luar", "Sukacinta", "Sukadana", "Sukajadi", "Sukamaju", "Sukamerindu", "Sukarami", "Sungai Rotan", "Tanding Marga", "Tanjung Miring"], kelurahan: [] },
    { nama: "Tanjung Agung", desa: ["Embawang", "Lesung Batu", "Matas", "Muara Emil", "Paduraksa", "Pagar Dewa", "Pandan Enim", "Penyandingan", "Pulau Panggung", "Seleman", "Tanjung Agung", "Tanjung Bulan", "Tanjung Karangan", "Tanjung Lalang"], kelurahan: [] },
    { nama: "Ujan Mas", desa: ["Guci", "Muara Gula Baru", "Muara Gula Lama", "Pinang Belarik", "Tanjung Raman", "Ujan Mas Baru", "Ujan Mas Lama", "Ulak Bandung", "Ujan Mas Ulu"], kelurahan: [] }
  ];

  console.log('🗺️ Mulai seeding wilayah dan pembuatan akun...')

  for (const [index, kec] of wilayahMuaraEnim.entries()) {
    // Gunakan index + 1 sebagai nomor kecamatan yang konsisten
    const nomorKecamatan = index + 1
    const kodeKec = `KEC-${String(nomorKecamatan).padStart(2, '0')}`

    const kecamatanRecord = await prisma.kecamatan.upsert({
      where: { kode: kodeKec },
      update: { nama: kec.nama },
      create: {
        id: randomUUID(),
        nama: kec.nama,
        kode: kodeKec,
      },
    })

    const allWilayah = [
      ...kec.desa.map(nama => ({ nama, tipe: TipeDesa.DESA, kecamatanId: kecamatanRecord.id })),
      ...kec.kelurahan.map(nama => ({ nama, tipe: TipeDesa.KELURAHAN, kecamatanId: kecamatanRecord.id }))
    ]

    let akunTerbuat = 0

    for (const wilayah of allWilayah) {
      // 1. Simpan atau ambil ID Desa/Kelurahan
      let desaRecord = await prisma.desaKelurahan.findFirst({
        where: {
          nama: wilayah.nama,
          kecamatanId: wilayah.kecamatanId,
        }
      })

      if (!desaRecord) {
        desaRecord = await prisma.desaKelurahan.create({
          data: {
            ...wilayah,
            id: randomUUID(),
          }
        })
      }

      // 2. Format Username: namadesa_nomorkecamatan (tanpa spasi, huruf kecil)
      // Contoh: "Pagar Dewa" di Kecamatan Benakat (index 2 -> no 3) menjadi "pagardewa_3"
      const cleanNamaDesa = wilayah.nama.toLowerCase().replace(/\s+/g, '')
      const usernameDesa = `${cleanNamaDesa}_${nomorKecamatan}`

      // 3. Simpan Akun User Pemdes
      await prisma.user.upsert({
        where: { username: usernameDesa },
        update: {},
        create: {
          id: randomUUID(),
          username: usernameDesa,
          password: hashedDesaPassword,
          nama: `Admin Desa ${wilayah.nama}`,
          role: Role.PEMDES,
          desaKelurahanId: desaRecord.id, // Referensi ke DesaKelurahan
          isActive: true,
        },
      })

      akunTerbuat++
    }

    console.log(`✅ ${kec.nama} (Kecamatan No.${nomorKecamatan}): Tersimpan ${allWilayah.length} Wilayah & ${akunTerbuat} Akun.`)
  }

  console.log('🎉 Seeding database selesai sepenuhnya!')
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })