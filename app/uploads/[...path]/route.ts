import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { path: pathSegments } = await params
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('File path missing', { status: 400 })
    }

    const safePath = pathSegments.join('/')
    // Primary path: root uploads folder
    let filePath = path.join(process.cwd(), 'uploads', safePath)

    try {
      const fileBuffer = await readFile(filepath(filePath))
      return createMediaResponse(safePath, fileBuffer)
    } catch {
      // Fallback: public/uploads folder if exists
      filePath = path.join(process.cwd(), 'public', 'uploads', safePath)
      try {
        const fileBuffer = await readFile(filePath)
        return createMediaResponse(safePath, fileBuffer)
      } catch {
        return new NextResponse('File not found', { status: 404 })
      }
    }
  } catch (err) {
    console.error('Error serving upload file:', err)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

function filepath(p: string) {
  return p
}

function createMediaResponse(filename: string, buffer: Buffer) {
  const ext = path.extname(filename).toLowerCase()
  let contentType = 'application/octet-stream'

  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
  else if (ext === '.png') contentType = 'image/png'
  else if (ext === '.webp') contentType = 'image/webp'
  else if (ext === '.svg') contentType = 'image/svg+xml'

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
