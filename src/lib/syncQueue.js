/**
 * File d'attente hors ligne — localStorage (métadonnées texte).
 * Les blobs photo/PDF/vidéo iront dans mediaStore.js (IndexedDB).
 */
import { storageKey } from './persistence.js'

const QUEUE_SUFFIX = '_queue'
const MAX_RETRIES = 5

function queueKey(user) {
  return `${storageKey(user)}${QUEUE_SUFFIX}`
}

function readQueue(user) {
  try {
    const raw = localStorage.getItem(queueKey(user))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeQueue(user, items) {
  try {
    localStorage.setItem(queueKey(user), JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

export function getPendingCount(user) {
  return readQueue(user).length
}

export function enqueue(user, item) {
  if (!user) return null
  const entry = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: item.type,
    payload: item.payload,
    tempId: item.tempId ?? null,
    createdAt: Date.now(),
    retries: 0,
  }
  const next = [...readQueue(user), entry]
  writeQueue(user, next)
  return entry
}

export function peekAll(user) {
  return readQueue(user)
}

export function remove(user, id) {
  writeQueue(user, readQueue(user).filter((x) => x.id !== id))
}

export function incrementRetry(user, id) {
  const items = readQueue(user).map((x) =>
    x.id === id ? { ...x, retries: (x.retries || 0) + 1 } : x,
  )
  writeQueue(user, items)
}

export function dropFailed(user) {
  writeQueue(user, readQueue(user).filter((x) => (x.retries || 0) < MAX_RETRIES))
}

export function clearQueue(user) {
  try {
    localStorage.removeItem(queueKey(user))
  } catch { /* ignore */ }
}
