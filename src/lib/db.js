import { supabase } from '../supabase.js'

const num = (v) => (v == null ? 0 : Number(v))
let cachedOrgId = null

function throwIfError(error) {
  if (error) throw error
}

export async function resolveOrgId(explicit) {
  if (explicit) return explicit
  if (cachedOrgId) return cachedOrgId
  if (!supabase) throw new Error('Supabase non configuré')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle()
  cachedOrgId = data?.org_id ?? null
  return cachedOrgId
}

function withOrg(row, orgId, userId) {
  const out = { ...row }
  if (orgId) out.org_id = orgId
  if (userId) out.user_id = userId
  return out
}

async function scopedRow(row, orgId) {
  const oid = await resolveOrgId(orgId)
  if (!supabase) return withOrg(row, oid, null)
  const { data: { user } } = await supabase.auth.getUser()
  return withOrg(row, oid, user?.id ?? null)
}

const OPTIONAL_TABLES = new Set(['equipe', 'heures', 'devis', 'commandes', 'incidents', 'clients', 'situations', 'planning_equipe', 'conges', 'agenda', 'notes_chantier', 'fournisseurs'])

async function selectAll(table, mapper) {
  const { data, error } = await supabase.from(table).select('*').order('id')
  if (error) {
    if (OPTIONAL_TABLES.has(table) && (error.code === 'PGRST205' || error.code === '42P01')) return []
    throw error
  }
  return (data ?? []).map(mapper)
}

// ── Mappers DB → interne ──────────────────────────────────────────

const mapChantier = (r) => ({
  id: r.id, nom: r.nom, client: r.client, tel: r.tel ?? '', corps: r.corps ?? '',
  statut: r.statut, avancement: num(r.avancement), budget: num(r.budget), depenses: num(r.depenses),
  debut: r.debut ?? '', fin: r.fin ?? '', equipe: Array.isArray(r.equipe) ? r.equipe : [],
  priorite: r.priorite ?? 'normale', note: r.note ?? '', adresse: r.adresse ?? '', meteo: r.meteo ?? '📋',
  rdv: r.rdv ?? '', taux_h: num(r.taux_h) || 35,
})

const mapTache = (r) => ({
  id: r.id, chantierId: r.chantier_id, titre: r.titre, responsable: r.responsable ?? '',
  debut: r.debut ?? '', fin: r.fin ?? '', statut: r.statut, duree: num(r.duree), priorite: r.priorite ?? 'normale',
})

const mapFacture = (r) => ({
  id: r.id, chantierId: r.chantier_id, chantier: r.chantier ?? '', client: r.client ?? '',
  montant: num(r.montant), statut: r.statut, date: r.date ?? '', echeance: r.echeance ?? '', description: r.description ?? '',
})

const mapMessage = (r) => ({
  id: r.id, chantierId: r.chantier_id, auteur: r.auteur, role: r.role ?? '', texte: r.texte, heure: r.heure ?? '', date: r.date ?? '',
})

const mapAvenant = (r) => ({
  id: r.id, chantierId: r.chantier_id, titre: r.titre, description: r.description ?? '', montant: num(r.montant),
  statut: r.statut, dateCreation: r.date_creation ?? '', dateValidation: r.date_validation ?? '', validePar: r.valide_par ?? '', ref: r.ref ?? '',
})

const mapHeure = (r) => ({
  id: r.id, membreId: r.membre_id, membreNom: r.membre_nom, chantierId: r.chantier_id, date: r.date ?? '',
  arrivee: r.arrivee ?? '', depart: r.depart ?? '', pauseMin: num(r.pause_min), description: r.description ?? '',
  valide: Boolean(r.valide), valideePar: r.validee_par ?? '', panier: Boolean(r.panier), trajet: Boolean(r.trajet), zone: num(r.zone) || 1,
})

const mapPunch = (r) => ({
  id: r.id, chantierId: r.chantier_id, titre: r.titre, description: r.description ?? '', categorie: r.categorie ?? 'Autre',
  priorite: r.priorite ?? 'normale', statut: r.statut, signalePar: r.signale_par ?? '', dateSignalement: r.date_signalement ?? '',
  dateResolution: r.date_resolution ?? '', assigneA: r.assigne_a ?? '', photos: num(r.photos),
})

const mapRapport = (r) => ({
  id: r.id, chantierId: r.chantier_id, date: r.date ?? '', auteur: r.auteur ?? '', meteo: r.meteo ?? '☀️',
  temperature: r.temperature ?? '', avancement: r.avancement ?? '', problemes: r.problemes ?? 'RAS',
  presences: Array.isArray(r.presences) ? r.presences : [], photos: num(r.photos),
})

const mapEquipe = (r) => ({
  id: r.id, nom: r.nom, role: r.role ?? '', fn: r.fn ?? r.role ?? '', tel: r.tel ?? '', heures: num(r.heures),
  chantiers: Array.isArray(r.chantiers) ? r.chantiers : [], dispo: Boolean(r.dispo),
  qual: r.qual ?? 'N2', taux_h: num(r.taux_h) || 35, statut_presence: r.statut_presence ?? 'present',
})

const mapDevis = (r) => ({
  id: r.id, ref: r.ref ?? '', client: r.client ?? '', objet: r.objet ?? '', date: r.date ?? '', validite: r.validite ?? '',
  statut: r.statut ?? 'brouillon', lots: Array.isArray(r.lots) ? r.lots : [], remise: num(r.remise), tva: num(r.tva) || 20,
})

const mapCommande = (r) => ({
  id: r.id, chantierId: r.chantier_id, ref: r.ref ?? '', fournisseur: r.fournisseur ?? '', objet: r.objet ?? '',
  montant: num(r.montant), statut: r.statut ?? 'attente', date: r.date ?? '', livraison: r.livraison ?? '', validePar: r.valide_par ?? '',
})

const mapIncident = (r) => {
  const p = r.payload && typeof r.payload === 'object' ? r.payload : {}
  return {
    id: r.id, chantierId: r.chantier_id, ref: r.ref ?? '', type: r.type ?? 'autre', description: r.description ?? '',
    priorite: num(r.priorite) || 2, statut: r.statut ?? 'ouvert', signalePar: r.signale_par ?? '', date: r.date ?? '',
    screen: r.screen ?? 'home', bloquant: Boolean(r.bloquant), ts: p.ts ?? null, refCmd: p.refCmd ?? null, fournisseurId: p.fournisseurId ?? null,
    payload: p,
  }
}

const mapClient = (r) => ({
  id: r.id, nom: r.nom ?? '', tel: r.tel ?? '', email: r.email ?? '', adresse: r.adresse ?? '',
  statut: r.statut ?? 'prospect', ca: num(r.ca), nbChantiers: num(r.nb_chantiers), note: r.note ?? '',
})

const mapSituation = (r) => ({
  id: r.id, chantierId: r.chantier_id, ref: r.ref ?? '', num: num(r.num) || 1, titre: r.titre ?? '',
  avancement: num(r.avancement), montant: num(r.montant), statut: r.statut ?? 'emise',
  date: r.date ?? '', echeance: r.echeance ?? '', description: r.description ?? '',
})

const mapPlanningEq = (r) => ({
  id: r.id, membreId: r.membre_id, nom: r.nom ?? '', sem: Array.isArray(r.sem) ? r.sem : [],
})

const mapConge = (r) => ({
  id: r.id, nom: r.nom ?? '', type: r.type ?? 'conge', debut: r.debut ?? '', fin: r.fin ?? '',
  jours: num(r.jours) || 1, statut: r.statut ?? 'attente', motif: r.motif ?? '',
})

const mapAgenda = (r) => ({
  id: r.id, chantierId: r.chantier_id, date: r.date ?? '', heure: r.heure ?? '', titre: r.titre ?? '',
  type: r.type ?? 'reunion', duree: num(r.duree) || 60, lieu: r.lieu ?? '',
})

const mapNote = (r) => ({
  id: r.id, chantierId: r.chantier_id, auteur: r.auteur ?? '', txt: r.txt ?? '', ts: num(r.ts), date: r.date ?? '',
})

const mapFournisseur = (r) => ({
  id: r.id, nom: r.nom ?? '', tel: r.tel ?? '', cat: r.cat ?? 'materiaux', url: r.url ?? '',
})

// ── Fetch all ─────────────────────────────────────────────────────

export async function fetchAllData() {
  if (!supabase) throw new Error('Supabase non configuré')
  const [
    chantiers, taches, factures, equipe, rapports, messages, avenants, heures, punchlist,
    devis, commandes, incidents, clients, situations, planning_equipe, conges, agenda, notes_chantier, fournisseurs,
  ] = await Promise.all([
    selectAll('chantiers', mapChantier), selectAll('taches', mapTache), selectAll('factures', mapFacture),
    selectAll('equipe', mapEquipe), selectAll('rapports', mapRapport), selectAll('messages', mapMessage),
    selectAll('avenants', mapAvenant), selectAll('heures', mapHeure), selectAll('punchlist', mapPunch),
    selectAll('devis', mapDevis), selectAll('commandes', mapCommande), selectAll('incidents', mapIncident),
    selectAll('clients', mapClient), selectAll('situations', mapSituation), selectAll('planning_equipe', mapPlanningEq),
    selectAll('conges', mapConge), selectAll('agenda', mapAgenda), selectAll('notes_chantier', mapNote),
    selectAll('fournisseurs', mapFournisseur),
  ])
  return {
    chantiers, taches, factures, equipe, rapports, messages, avenants, heures, punchlist,
    devis, commandes, incidents, clients, situations, planning_equipe, conges, agenda, notes_chantier, fournisseurs,
  }
}

export async function fetchOrgPlan(orgId) {
  if (!orgId || !supabase) return 'pro'
  const { data } = await supabase.from('organizations').select('plan_id').eq('id', orgId).maybeSingle()
  return data?.plan_id ?? 'pro'
}

// ── Chantiers ─────────────────────────────────────────────────────

export async function insertChantier(f, orgId) {
  const row = await scopedRow({
    nom: f.nom || 'Nouveau', client: f.client || 'Client', tel: f.tel || '', corps: f.corps || '',
    statut: f.statut || 'en_cours', avancement: 0, budget: parseInt(f.budget, 10) || 0, depenses: 0,
    debut: f.debut || null, fin: f.fin || null, equipe: [], priorite: f.priorite || 'normale',
    note: f.note || '', adresse: f.adresse || '', meteo: '📋', rdv: f.rdv || '', taux_h: f.taux_h || 35,
  }, orgId)
  const { data, error } = await supabase.from('chantiers').insert(row).select().single()
  throwIfError(error)
  return mapChantier(data)
}

export async function updateChantier(id, key, value) {
  const colMap = { chantierId: 'chantier_id', taux_h: 'taux_h' }
  const col = colMap[key] ?? key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  const { data, error } = await supabase.from('chantiers').update({ [col]: value }).eq('id', id).select().single()
  throwIfError(error)
  return mapChantier(data)
}

// ── Tâches ────────────────────────────────────────────────────────

export async function insertTache(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, titre: f.titre || 'Tâche', responsable: f.responsable || '',
    debut: f.debut || null, fin: f.fin || null, statut: f.statut || 'a_faire', duree: Math.max(1, f.duree || 1), priorite: f.priorite || 'normale',
  }, orgId)
  const { data, error } = await supabase.from('taches').insert(row).select().single()
  throwIfError(error)
  return mapTache(data)
}

export async function updateTache(id, key, value) {
  const colMap = { chantierId: 'chantier_id' }
  const col = colMap[key] ?? key
  const { data, error } = await supabase.from('taches').update({ [col]: value }).eq('id', id).select().single()
  throwIfError(error)
  return mapTache(data)
}

// ── Factures ──────────────────────────────────────────────────────

export async function insertFacture(f, orgId) {
  const row = await scopedRow({
    id: f.id || `FAC-${Date.now()}`, chantier_id: parseInt(f.chantierId, 10) || 0,
    chantier: f.chantier || '', client: f.client || '', montant: parseInt(f.montant, 10) || 0,
    statut: f.statut || 'emise', date: f.date || null, echeance: f.echeance || null, description: f.description || '',
  }, orgId)
  const { data, error } = await supabase.from('factures').insert(row).select().single()
  throwIfError(error)
  return mapFacture(data)
}

export async function updateFactureStatut(id, statut) {
  const { data, error } = await supabase.from('factures').update({ statut }).eq('id', id).select().single()
  throwIfError(error)
  return mapFacture(data)
}

// ── Messages / Rapports / Avenants / Punch / Heures ───────────────

export async function insertMessage(m, orgId) {
  const row = await scopedRow({
    chantier_id: m.chantierId, auteur: m.auteur, role: m.role || '', texte: m.texte, heure: m.heure || '', date: m.date || null,
  }, orgId)
  const { data, error } = await supabase.from('messages').insert(row).select().single()
  throwIfError(error)
  return mapMessage(data)
}

export async function insertRapport(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, date: f.date || null, auteur: f.auteur || '', meteo: f.meteo || '☀️',
    temperature: f.temperature || '', avancement: f.avancement || '', problemes: f.problemes || 'RAS', presences: f.presences || [], photos: 0,
  }, orgId)
  const { data, error } = await supabase.from('rapports').insert(row).select().single()
  throwIfError(error)
  return mapRapport(data)
}

export async function insertAvenant(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, titre: f.titre || '', description: f.description || '',
    montant: parseInt(f.montant, 10) || 0, statut: 'en_attente', ref: f.ref || '',
    date_creation: new Date().toISOString().split('T')[0], date_validation: null, valide_par: '',
  }, orgId)
  const { data, error } = await supabase.from('avenants').insert(row).select().single()
  throwIfError(error)
  return mapAvenant(data)
}

export async function updateAvenant(id, statut, validePar) {
  const row = { statut, valide_par: validePar, date_validation: new Date().toISOString().split('T')[0] }
  const { data, error } = await supabase.from('avenants').update(row).eq('id', id).select().single()
  throwIfError(error)
  return mapAvenant(data)
}

export async function insertPunchItem(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, titre: f.titre || '', description: f.description || '',
    categorie: f.categorie || 'Autre', priorite: f.priorite || 'normale', statut: f.statut || 'ouvert',
    signale_par: f.signalePar || '', date_signalement: f.dateSignalement || new Date().toISOString().split('T')[0],
    date_resolution: null, assigne_a: f.assigneA || '', photos: 0,
  }, orgId)
  const { data, error } = await supabase.from('punchlist').insert(row).select().single()
  throwIfError(error)
  return mapPunch(data)
}

export async function updatePunchStatut(id, statut) {
  const row = { statut, date_resolution: statut === 'resolu' ? new Date().toISOString().split('T')[0] : null }
  const { data, error } = await supabase.from('punchlist').update(row).eq('id', id).select().single()
  throwIfError(error)
  return mapPunch(data)
}

export async function insertHeure(f, orgId) {
  const row = await scopedRow({
    membre_id: f.membreId || null, membre_nom: f.membreNom || f.nom || '', chantier_id: parseInt(f.chantierId, 10) || 0,
    date: f.date || new Date().toISOString().split('T')[0], arrivee: f.arrivee || '', depart: f.depart || '',
    pause_min: f.pauseMin || 0, description: f.description || '', valide: false, panier: Boolean(f.panier),
    trajet: Boolean(f.trajet), zone: f.zone || 1,
  }, orgId)
  const { data, error } = await supabase.from('heures').insert(row).select().single()
  throwIfError(error)
  return mapHeure(data)
}

export async function updateHeure(id, valideePar) {
  const { data, error } = await supabase.from('heures').update({ valide: true, validee_par: valideePar }).eq('id', id).select().single()
  throwIfError(error)
  return mapHeure(data)
}

// ── Devis ─────────────────────────────────────────────────────────

export async function insertDevis(f, orgId) {
  const row = await scopedRow({
    ref: f.ref || '', client: f.client || '', objet: f.objet || '', date: f.date || null, validite: f.validite || null,
    statut: f.statut || 'brouillon', lots: f.lots || [], remise: f.remise || 0, tva: f.tva || 20,
  }, orgId)
  const { data, error } = await supabase.from('devis').insert(row).select().single()
  throwIfError(error)
  return mapDevis(data)
}

export async function updateDevis(id, patch) {
  const { data, error } = await supabase.from('devis').update(patch).eq('id', id).select().single()
  throwIfError(error)
  return mapDevis(data)
}

// ── Commandes ─────────────────────────────────────────────────────

export async function insertCommande(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, ref: f.ref || '', fournisseur: f.fournisseur || '',
    objet: f.objet || '', montant: parseInt(f.montant, 10) || 0, statut: f.statut || 'attente',
    date: f.date || null, livraison: f.livraison || null, valide_par: f.validePar || '',
  }, orgId)
  const { data, error } = await supabase.from('commandes').insert(row).select().single()
  throwIfError(error)
  return mapCommande(data)
}

export async function updateCommande(id, patch) {
  const { data, error } = await supabase.from('commandes').update(patch).eq('id', id).select().single()
  throwIfError(error)
  return mapCommande(data)
}

// ── Incidents ─────────────────────────────────────────────────────

export async function insertIncident(f, orgId) {
  const payload = { ts: f.ts, refCmd: f.refCmd, fournisseurId: f.fournisseurId }
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, ref: f.ref || '', type: f.type || 'autre',
    description: f.description || f.desc || '', priorite: f.priorite || f.prio || 2, statut: f.statut || 'ouvert',
    signale_par: f.signalePar || f.sig || '', date: f.date || '', screen: f.screen || 'home',
    bloquant: Boolean(f.bloquant), payload,
  }, orgId)
  const { data, error } = await supabase.from('incidents').insert(row).select().single()
  throwIfError(error)
  return mapIncident(data)
}

export async function updateIncident(id, patch) {
  const dbPatch = {}
  if (patch.statut) dbPatch.statut = patch.statut
  if (patch.desc || patch.description) dbPatch.description = patch.desc || patch.description
  if (patch.prio || patch.priorite) dbPatch.priorite = patch.prio || patch.priorite
  if (patch.type) dbPatch.type = patch.type
  if (patch.bloquant != null) dbPatch.bloquant = patch.bloquant
  const extra = {}
  if (patch.refCmd != null) extra.refCmd = patch.refCmd
  if (patch.fournisseurId != null) extra.fournisseurId = patch.fournisseurId
  if (patch.ts != null) extra.ts = patch.ts
  if (Object.keys(extra).length) dbPatch.payload = extra
  const { data, error } = await supabase.from('incidents').update(dbPatch).eq('id', id).select().single()
  throwIfError(error)
  return mapIncident(data)
}

export async function deleteIncident(id) {
  const { error } = await supabase.from('incidents').delete().eq('id', id)
  throwIfError(error)
}

// ── Clients ───────────────────────────────────────────────────────

export async function insertClient(f, orgId) {
  const row = await scopedRow({
    nom: f.nom || '', tel: f.tel || '', email: f.email || '', adresse: f.adresse || '',
    statut: f.statut || 'prospect', ca: parseInt(f.ca, 10) || 0, nb_chantiers: parseInt(f.nbChantiers, 10) || 0, note: f.note || '',
  }, orgId)
  const { data, error } = await supabase.from('clients').insert(row).select().single()
  throwIfError(error)
  return mapClient(data)
}

// ── Situations ────────────────────────────────────────────────────

export async function insertSituation(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, ref: f.ref || '', num: f.num || 1, titre: f.titre || '',
    avancement: parseInt(f.avancement || f.av, 10) || 0, montant: parseInt(f.montant || f.mt, 10) || 0,
    statut: f.statut || 'emise', date: f.date || null, echeance: f.echeance || f.ech || null, description: f.description || f.desc || '',
  }, orgId)
  const { data, error } = await supabase.from('situations').insert(row).select().single()
  throwIfError(error)
  return mapSituation(data)
}

export async function updateSituation(id, statut) {
  const { data, error } = await supabase.from('situations').update({ statut }).eq('id', id).select().single()
  throwIfError(error)
  return mapSituation(data)
}

// ── Planning équipe ───────────────────────────────────────────────

export async function upsertPlanningEq(membre, orgId) {
  const row = await scopedRow({ membre_id: membre.membreId || membre.id, nom: membre.nom || '', sem: membre.sem || [] }, oid)
  if (membre.dbId) {
    const { data, error } = await supabase.from('planning_equipe').update({ sem: row.sem }).eq('id', membre.dbId).select().single()
    throwIfError(error)
    return mapPlanningEq(data)
  }
  const { data, error } = await supabase.from('planning_equipe').insert(row).select().single()
  throwIfError(error)
  return mapPlanningEq(data)
}

// ── Congés ────────────────────────────────────────────────────────

export async function insertConge(f, orgId) {
  const row = await scopedRow({
    nom: f.nom || '', type: f.type || 'conge', debut: f.debut || '', fin: f.fin || '',
    jours: Math.max(1, f.jours || 1), statut: f.statut || 'attente', motif: f.motif || '',
  }, orgId)
  const { data, error } = await supabase.from('conges').insert(row).select().single()
  throwIfError(error)
  return mapConge(data)
}

export async function updateConge(id, statut) {
  const { data, error } = await supabase.from('conges').update({ statut }).eq('id', id).select().single()
  throwIfError(error)
  return mapConge(data)
}

// ── Agenda ────────────────────────────────────────────────────────

export async function insertAgenda(f, orgId) {
  const row = await scopedRow({
    chantier_id: f.chantierId ? parseInt(f.chantierId, 10) : null, date: f.date || '', heure: f.heure || '',
    titre: f.titre || '', type: f.type || 'reunion', duree: f.duree || 60, lieu: f.lieu || '',
  }, orgId)
  const { data, error } = await supabase.from('agenda').insert(row).select().single()
  throwIfError(error)
  return mapAgenda(data)
}

export async function deleteAgenda(id) {
  const { error } = await supabase.from('agenda').delete().eq('id', id)
  throwIfError(error)
}

// ── Notes ─────────────────────────────────────────────────────────

export async function insertNote(f, orgId) {
  const row = await scopedRow({
    chantier_id: parseInt(f.chantierId, 10) || 0, auteur: f.auteur || '', txt: f.txt || '',
    ts: f.ts || Date.now(), date: f.date || '',
  }, orgId)
  const { data, error } = await supabase.from('notes_chantier').insert(row).select().single()
  throwIfError(error)
  return mapNote(data)
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes_chantier').delete().eq('id', id)
  throwIfError(error)
}

// ── Fournisseurs ──────────────────────────────────────────────────

export async function insertFournisseur(f, orgId) {
  const row = await scopedRow({ nom: f.nom || '', tel: f.tel || '', cat: f.cat || 'materiaux', url: f.url || '' }, oid)
  const { data, error } = await supabase.from('fournisseurs').insert(row).select().single()
  throwIfError(error)
  return mapFournisseur(data)
}

export async function updateFournisseur(id, patch) {
  const { data, error } = await supabase.from('fournisseurs').update(patch).eq('id', id).select().single()
  throwIfError(error)
  return mapFournisseur(data)
}

export async function deleteFournisseur(id) {
  const { error } = await supabase.from('fournisseurs').delete().eq('id', id)
  throwIfError(error)
}

// ── Équipe ────────────────────────────────────────────────────────

export async function updateEquipeStatut(id, statut) {
  const { data, error } = await supabase.from('equipe').update({ statut_presence: statut }).eq('id', id).select().single()
  throwIfError(error)
  return mapEquipe(data)
}
