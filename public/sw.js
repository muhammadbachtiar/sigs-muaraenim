// Service Worker — SIGS Muara Enim
// Strategi: Network-First untuk API, Cache-First untuk aset statis

const CACHE_NAME = 'sigs-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo_muara_enim.png',
]

// Install: Cache aset statis minimum
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: Bersihkan cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: Network-First untuk API, Cache-First untuk aset statis
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET & non-same-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API routes: Network-First (selalu coba dari server dulu)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Simpan response ke cache untuk fallback offline
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Fallback ke cache jika network gagal
          return caches.match(request).then((cached) => {
            if (cached) return cached
            return new Response(
              JSON.stringify({
                success: false,
                message: 'Anda sedang offline. Data tidak dapat dimuat.',
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          })
        })
    )
    return
  }

  // GeoJSON data: Network-First (data wilayah bisa berubah)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Aset statis lainnya (JS, CSS, images): Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
