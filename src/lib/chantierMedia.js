import { supabase } from '../supabase.js'
import { getMediaBlob, deleteMediaBlob, detectMediaType } from './mediaStore.js'

export const CHANTIER_MEDIA_BUCKET = 'chantier-media'

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
])
const MAX_BYTES = 50 * 1024 * 1024

export function buildMediaPath(orgId, chId, clientId, filename) {
  const safe = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
  return `${orgId}/${chId}/${clientId}/${safe}`
}

function assertMediaBlob(name, mime, size, blob) {
  const type = (mime || blob?.type || '').toLowerCase().split(';')[0].trim()
  if (!ALLOWED_MIME.has(type)) {
    throw new Error('Type de fichier non autorisé')
  }
  const bytes = size || blob?.size || 0
  if (bytes > MAX_BYTES) {
    throw new Error('Fichier trop volumineux (max 50 Mo)')
  }
}

export async function uploadChantierMedia({ orgId, chId, clientId, name, mime, size, blob }) {
  if (!supabase) throw new Error('Supabase non configuré')
  assertMediaBlob(name, mime, size, blob)
  const path = buildMediaPath(orgId, chId, clientId, name)
  const contentType = (mime || blob.type || 'application/octet-stream').toLowerCase().split(';')[0].trim()
  const { error } = await supabase.storage.from(CHANTIER_MEDIA_BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  })
  if (error) throw error
  return { path, name, mime: contentType, size: size || blob.size }
}

export async function getSignedMediaUrl(path, expiresIn = 3600) {
  if (!supabase || !path) return null
  const { data, error } = await supabase.storage.from(CHANTIER_MEDIA_BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

/** Upload blob IndexedDB puis retourne les métadonnées attachment. */
export async function resolveMessageMedia(m, orgId) {
  if (!m.mediaClientId) {
    return {
      type: m.type || 'text',
      attachments: m.attachments || [],
    }
  }
  const record = await getMediaBlob(m.mediaClientId)
  if (!record) {
    return {
      type: m.type || 'text',
      attachments: m.attachments || [],
    }
  }
  const att = await uploadChantierMedia({
    orgId,
    chId: m.chId,
    clientId: m.mediaClientId,
    name: record.name,
    mime: record.mime,
    size: record.size,
    blob: record.blob,
  })
  await deleteMediaBlob(m.mediaClientId)
  return {
    type: detectMediaType(record.mime),
    attachments: [att],
  }
}
