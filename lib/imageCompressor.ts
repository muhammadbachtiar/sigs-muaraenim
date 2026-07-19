/**
 * lib/imageCompressor.ts
 * Utilitas kompresi gambar berbasis Canvas API di sisi client.
 * Digunakan untuk auto-compress foto kamera yang > 2MB.
 */

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_DIMENSION = 1920 // max lebar/tinggi pixel
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.5] // step-down kualitas

export type CompressionResult = {
  file: File
  originalSize: number
  compressedSize: number
  wasCompressed: boolean
  originalName: string
  format: string
  status: 'ok' | 'compressed' | 'too_large' | 'invalid_format'
  message: string
}

const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Memuat gambar dari File ke HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Mengecilkan dimensi gambar proporsional ke max dimension
 */
function getResizedDimensions(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height }
  }
  const ratio = Math.min(maxDim / width, maxDim / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

/**
 * Render gambar ke Canvas dan export sebagai Blob dengan kualitas tertentu
 */
function canvasToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }
    ctx.drawImage(img, 0, 0, width, height)
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Kompresi gambar secara otomatis jika melebihi 2MB.
 *
 * Alur:
 * 1. Cek apakah format didukung
 * 2. Jika ukuran <= 2MB, langsung return (tidak dikompresi)
 * 3. Jika > 2MB, resize ke max 1920px dan turunkan kualitas JPEG
 *    secara bertahap (0.85 → 0.75 → 0.65 → 0.5) hingga di bawah 2MB
 * 4. Jika masih > 2MB setelah kualitas terendah, return status 'too_large'
 */
export async function compressImage(file: File): Promise<CompressionResult> {
  const originalSize = file.size
  const originalName = file.name
  const format = file.type || 'unknown'

  // Cek format
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      originalName,
      format,
      status: 'invalid_format',
      message: `Format file "${format}" tidak didukung. Gunakan JPEG, PNG, atau WebP.`,
    }
  }

  // Jika sudah di bawah limit, tidak perlu kompresi
  if (originalSize <= MAX_FILE_SIZE) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      wasCompressed: false,
      originalName,
      format,
      status: 'ok',
      message: 'Ukuran file sudah sesuai batas.',
    }
  }

  // Load & resize
  const img = await loadImage(file)
  const { width, height } = getResizedDimensions(img.naturalWidth, img.naturalHeight, MAX_DIMENSION)

  // Coba kompresi dengan kualitas step-down
  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(img, width, height, quality)
    if (blob && blob.size <= MAX_FILE_SIZE) {
      const compressedFile = new File([blob], originalName.replace(/\.[^.]+$/, '.jpg'), {
        type: 'image/jpeg',
      })
      return {
        file: compressedFile,
        originalSize,
        compressedSize: blob.size,
        wasCompressed: true,
        originalName,
        format: 'image/jpeg',
        status: 'compressed',
        message: `Foto dikompresi dari ${formatBytes(originalSize)} menjadi ${formatBytes(blob.size)}.`,
      }
    }
  }

  // Gagal dikompresi di bawah limit
  // Tetap return file yang sudah di-resize pada kualitas terendah
  const lastBlob = await canvasToBlob(img, width, height, QUALITY_STEPS[QUALITY_STEPS.length - 1])
  if (lastBlob) {
    const compressedFile = new File([lastBlob], originalName.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg',
    })
    return {
      file: compressedFile,
      originalSize,
      compressedSize: lastBlob.size,
      wasCompressed: true,
      originalName,
      format: 'image/jpeg',
      status: 'too_large',
      message: `Ukuran masih ${formatBytes(lastBlob.size)} setelah kompresi. Melebihi batas 2MB.`,
    }
  }

  return {
    file,
    originalSize,
    compressedSize: originalSize,
    wasCompressed: false,
    originalName,
    format,
    status: 'too_large',
    message: 'Gagal mengompresi gambar. Coba gunakan gambar dengan resolusi lebih kecil.',
  }
}

/**
 * Format bytes ke string manusia (misal: "4.2 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
