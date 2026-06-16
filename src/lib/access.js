/** Filtrage d'accès par rôle / chantiers assignés */

export const chIdsOf = (u) => u?.chIds || []

export const isAdmin = (u) => u?.role === 'admin'

export const canSeeCh = (u, chId) =>
  isAdmin(u) || chIdsOf(u).includes(Number(chId))

export const filterByChAccess = (user, rows, chKey = 'chId') => {
  if (!rows?.length) return []
  if (isAdmin(user)) return rows
  const ids = new Set(chIdsOf(user).map(Number))
  return rows.filter((r) => ids.has(Number(r[chKey])))
}

export const visibleChantiers = (user, chantiers) => {
  if (!chantiers?.length) return []
  if (isAdmin(user)) return chantiers
  const ids = new Set(chIdsOf(user).map(Number))
  return chantiers.filter((c) => ids.has(Number(c.id)))
}

export const chOuverts = (chs) => (chs || []).filter((c) => c.statut !== 'livre')
