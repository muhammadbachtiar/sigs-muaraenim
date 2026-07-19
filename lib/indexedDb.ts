/**
 * lib/indexedDb.ts
 * Helper IndexedDB untuk menyimpan draf lokal (sinyal & tower).
 * Tidak menggunakan library eksternal — pure IndexedDB wrapper.
 */

const DB_NAME = 'sigs-drafts'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DraftType = 'sinyal' | 'tower'

export type Draft = {
  id?: number // auto-increment key
  type: DraftType
  data: Record<string, any>
  createdAt: string // ISO string
  wasOffline: boolean // true jika disimpan saat offline
  label: string // Ringkasan singkat isi draf (misal: "Telkomsel — Desa Air Asam")
}

// ─── Open DB ──────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

/** Menyimpan draf baru ke IndexedDB */
export async function saveDraft(draft: Omit<Draft, 'id'>): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(draft)
    request.onsuccess = () => resolve(request.result as number)
    request.onerror = () => reject(request.error)
  })
}

/** Memperbarui draf yang sudah ada */
export async function updateDraft(draft: Draft): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(draft)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Mengambil semua draf, diurutkan dari yang terbaru */
export async function getAllDrafts(): Promise<Draft[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const results = (request.result as Draft[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      resolve(results)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Mengambil draf berdasarkan tipe */
export async function getDraftsByType(type: DraftType): Promise<Draft[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('type')
    const request = index.getAll(type)
    request.onsuccess = () => {
      const results = (request.result as Draft[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      resolve(results)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Mengambil draf berdasarkan ID */
export async function getDraftById(id: number): Promise<Draft | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve((request.result as Draft) ?? null)
    request.onerror = () => reject(request.error)
  })
}

/** Menghapus draf berdasarkan ID */
export async function deleteDraft(id: number): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Menghapus semua draf */
export async function clearAllDrafts(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Menghitung jumlah draf tersimpan */
export async function countDrafts(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
