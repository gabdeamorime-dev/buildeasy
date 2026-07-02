/** Autorise http(s), mailto, tel — bloque javascript:, data:, vbscript: */
const ALLOWED = /^(https?:|mailto:|tel:)/i

export function safeHref(url) {
  const u = String(url || '').trim()
  if (!u) return null
  if (ALLOWED.test(u)) return u
  if (u.startsWith('//')) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null
  return u
}

export function safeExternalHref(url) {
  const u = safeHref(url)
  if (!u) return null
  if (/^https?:/i.test(u)) return u
  return null
}
