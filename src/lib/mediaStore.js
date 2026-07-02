/**
 * Stockage local IndexedDB pour pièces jointes chat (photos, PDF, vidéos).
 * Utilisé hors ligne ; upload Supabase Storage à la reconnexion (à brancher).
 */
const DB_NAME = 'buildeasy_media'
const DB_VERSION = 1
const STORE = 'blobs'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** @typedef {{ clientId: string, messageTempId: number, chId: number, name: string, mime: string, size: number, blob: Blob, createdAt: number }} MediaRecord */

/** @param {Omit<MediaRecord, 'createdAt'>} record */
export async function saveMediaBlob(record) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...record, createdAt: Date.now() })
    tx.oncomplete = () => { db.close(); resolve(record.clientId) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** @param {string} clientId */
export async function getMediaBlob(clientId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(clientId)
    req.onsuccess = () => { db.close(); resolve(req.result || null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

/** @param {string} clientId */
export async function deleteMediaBlob(clientId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(clientId)
    tx.oncomplete = () => { db.close(); resolve(true) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function listPendingMedia() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => { db.close(); resolve(req.result || []) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export const MEDIA_LIMITS = {
  image: 10 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
}

export function detectMediaType(mime) {
  if (!mime) return 'file'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  return 'file'
}
