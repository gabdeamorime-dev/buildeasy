/** Applique les remplacements d'ID temporaires après flush de la file offline. */
export function applyOfflineRemap({ type, tempId, result }, set) {
  if (!tempId || !result) return
  const patch = (list) => list.map((x) => (x.id === tempId ? { ...x, ...result, pending: false } : x))

  switch (type) {
    case 'insertMessage': set.setMessages((p) => patch(p).map((m) => ({ ...m, localPreview: null, mediaClientId: null }))); break
    case 'insertTache': set.setTaches((p) => patch(p)); break
    case 'insertRapport': set.setRapports((p) => patch(p)); break
    case 'insertAvenant': set.setAvenants((p) => patch(p)); break
    case 'insertPunch': set.setPunch((p) => patch(p)); break
    case 'insertHeure': set.setHeures((p) => patch(p)); break
    case 'insertFacture': set.setFactures((p) => patch(p)); break
    case 'insertDevis': set.setDevis((p) => patch(p)); break
    case 'insertCommande': set.setCommandes((p) => patch(p)); break
    case 'insertIncident': set.setIncidents((p) => patch(p)); break
    case 'insertClient': set.setClients((p) => patch(p)); break
    case 'insertSituation': set.setSituations((p) => patch(p)); break
    case 'insertConge': set.setConges((p) => patch(p)); break
    case 'insertAgenda': set.setAgenda((p) => patch(p)); break
    case 'insertNote': set.setNotes((p) => patch(p)); break
    case 'insertFournisseur': set.setFournisseurs((p) => patch(p)); break
    case 'insertChantier': set.setChantiers((p) => patch(p)); break
    default: break
  }
}

export function mergeMessages(local, remote) {
  const byKey = new Map()
  const keyOf = (m) => (m.clientId ? `c:${m.clientId}` : `id:${m.id}`)
  for (const m of remote) byKey.set(keyOf(m), m)
  for (const m of local) {
    if (m.pending || isTempId(m.id) || m.localPreview || m.mediaClientId) {
      byKey.set(keyOf(m), m)
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const da = `${a.d || ''} ${a.h || ''}`
    const db = `${b.d || ''} ${b.h || ''}`
    return da.localeCompare(db)
  })
}

export function isTempId(id) {
  return typeof id === 'number' && id > 1e12
}
