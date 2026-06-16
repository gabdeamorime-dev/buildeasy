const STORAGE_VERSION = 1

export const APP_STATE_KEYS = [
  'chantiers', 'taches', 'heures', 'commandes', 'devis', 'incidents', 'factures',
  'clients', 'equipe', 'rapports', 'messages', 'avenants', 'punch', 'situations',
  'planningEq', 'conges', 'agenda', 'notes', 'fournisseurs',
]

export function storageKey(user) {
  const id = user?.email || user?.id || 'anon'
  return `be_v${STORAGE_VERSION}_${String(id).toLowerCase()}`
}

export function loadAppState(user, defaults) {
  try {
    const raw = localStorage.getItem(storageKey(user))
    if (!raw) return { ...defaults, _persisted: false }
    const parsed = JSON.parse(raw)
    const merged = { ...defaults }
    for (const k of APP_STATE_KEYS) {
      if (Array.isArray(parsed[k])) merged[k] = parsed[k]
    }
    merged._persisted = true
    merged._savedAt = parsed._savedAt || null
    return merged
  } catch {
    return { ...defaults, _persisted: false }
  }
}

export function saveAppState(user, slices) {
  try {
    const payload = { _savedAt: Date.now() }
    for (const k of APP_STATE_KEYS) {
      if (slices[k] !== undefined) payload[k] = slices[k]
    }
    localStorage.setItem(storageKey(user), JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function clearAppState(user) {
  try {
    localStorage.removeItem(storageKey(user))
    return true
  } catch {
    return false
  }
}

export function lastChKey(user) {
  return `be_lastCh_${String(user?.email || user?.id || 'anon').toLowerCase()}`
}

export function loadLastChId(user) {
  try {
    const v = localStorage.getItem(lastChKey(user))
    return v ? parseInt(v, 10) : null
  } catch {
    return null
  }
}

export function saveLastChId(user, chId) {
  try {
    if (chId) localStorage.setItem(lastChKey(user), String(chId))
    return true
  } catch {
    return false
  }
}
