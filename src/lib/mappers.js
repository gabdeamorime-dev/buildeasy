const SKIP = new Set(['org_id', 'created_at'])

/** Colonne SQL `description` ↔ champ UI `desc` */
const DESC_COL = 'description'

export function snakeToCamel(s) {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

export function camelToSnake(s) {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

/** Ligne Supabase → objet UI (camelCase, id numérique si possible) */
export function rowToApp(row) {
  if (!row) return null
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (SKIP.has(k)) continue
    let key = snakeToCamel(k)
    if (k === DESC_COL) key = 'desc'
    if (key === 'id' && typeof v === 'string' && /^\d+$/.test(v)) {
      out.id = Number(v)
    } else if (key === 'chId' && v != null) {
      out.chId = Number(v)
    } else if (key === 'chIds' && Array.isArray(v)) {
      out.chIds = v.map(Number)
    } else {
      out[key] = v
    }
  }
  return out
}

/** Objet UI → insert/update Supabase */
export function appToRow(obj, orgId, { partial = false } = {}) {
  const out = {}
  if (orgId && !partial) out.org_id = orgId
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' && v == null) continue
    let col = camelToSnake(k)
    if (k === 'desc') col = DESC_COL
    if (col === 'ch_ids' && Array.isArray(v)) {
      out.ch_ids = v.map(Number)
    } else if (col === 'ch_id' && v != null && v !== '') {
      out.ch_id = Number(v)
    } else if (v !== undefined) {
      out[col] = v
    }
  }
  return out
}

export function rowsToApp(rows) {
  return (rows || []).map(rowToApp)
}
