import { supabase } from './supabase.js'

const num = (v) => (v == null ? 0 : Number(v))

const mapChantier = (r) => ({
  id: r.id,
  nom: r.nom,
  client: r.client,
  tel: r.tel ?? '',
  corps: r.corps ?? '',
  statut: r.statut,
  avancement: num(r.avancement),
  budget: num(r.budget),
  depenses: num(r.depenses),
  debut: r.debut ?? '',
  fin: r.fin ?? '',
  equipe: Array.isArray(r.equipe) ? r.equipe : [],
  priorite: r.priorite ?? 'normale',
  note: r.note ?? '',
  adresse: r.adresse ?? '',
  meteo: r.meteo ?? '📋',
})

const mapTache = (r) => ({
  id: r.id,
  chantierId: r.chantier_id,
  titre: r.titre,
  responsable: r.responsable ?? '',
  debut: r.debut ?? '',
  fin: r.fin ?? '',
  statut: r.statut,
  duree: num(r.duree),
  priorite: r.priorite ?? 'normale',
})

const mapFacture = (r) => ({
  id: r.id,
  chantierId: r.chantier_id,
  chantier: r.chantier ?? '',
  client: r.client ?? '',
  montant: num(r.montant),
  statut: r.statut,
  date: r.date ?? '',
  echeance: r.echeance ?? '',
})

const mapMessage = (r) => ({
  id: r.id,
  chantierId: r.chantier_id,
  auteur: r.auteur,
  role: r.role ?? '',
  texte: r.texte,
  heure: r.heure ?? '',
  date: r.date ?? '',
})

const mapAvenant = (r) => ({
  id: r.id,
  chantierId: r.chantier_id,
  titre: r.titre,
  description: r.description ?? '',
  montant: num(r.montant),
  statut: r.statut,
  dateCreation: r.date_creation ?? '',
  dateValidation: r.date_validation ?? '',
  validePar: r.valide_par ?? '',
})

const mapHeure = (r) => ({
  id: r.id,
  membreId: r.membre_id,
  membreNom: r.membre_nom,
  chantierId: r.chantier_id,
  date: r.date ?? '',
  arrivee: r.arrivee ?? '',
  depart: r.depart ?? '',
  pauseMin: num(r.pause_min),
  description: r.description ?? '',
  valide: Boolean(r.valide),
  valideePar: r.validee_par ?? '',
})

const mapPunch = (r) => ({
  id: r.id,
  chantierId: r.chantier_id,
  titre: r.titre,
  description: r.description ?? '',
  categorie: r.categorie ?? 'Autre',
  priorite: r.priorite ?? 'normale',
  statut: r.statut,
  signalePar: r.signale_par ?? '',
  dateSignalement: r.date_signalement ?? '',
  dateResolution: r.date_resolution ?? '',
  assigneA: r.assigne_a ?? '',
  photos: num(r.photos),
})

const mapRapport = (r) => ({
  id: r.id,
  chantierId: r.chantier_id,
  date: r.date ?? '',
  auteur: r.auteur ?? '',
  meteo: r.meteo ?? '☀️',
  temperature: r.temperature ?? '',
  avancement: r.avancement ?? '',
  problemes: r.problemes ?? 'RAS',
  presences: Array.isArray(r.presences) ? r.presences : [],
  photos: num(r.photos),
})

const mapEquipe = (r) => ({
  id: r.id,
  nom: r.nom,
  role: r.role ?? '',
  tel: r.tel ?? '',
  heures: num(r.heures),
  chantiers: Array.isArray(r.chantiers) ? r.chantiers : [],
  dispo: Boolean(r.dispo),
})

function throwIfError(error) {
  if (error) throw error
}

/** Tables optionnelles (écran équipe / heures) — ignorées si absentes du projet */
const OPTIONAL_TABLES = new Set(['equipe', 'heures'])

async function selectAll(table, mapper) {
  const { data, error } = await supabase.from(table).select('*').order('id')
  if (error) {
    if (OPTIONAL_TABLES.has(table) && (error.code === 'PGRST205' || error.code === '42P01')) {
      return []
    }
    throw error
  }
  return (data ?? []).map(mapper)
}

export async function fetchAllData() {
  const [
    chantiers,
    taches,
    factures,
    equipe,
    rapports,
    messages,
    avenants,
    heures,
    punchlist,
  ] = await Promise.all([
    selectAll('chantiers', mapChantier),
    selectAll('taches', mapTache),
    selectAll('factures', mapFacture),
    selectAll('equipe', mapEquipe),
    selectAll('rapports', mapRapport),
    selectAll('messages', mapMessage),
    selectAll('avenants', mapAvenant),
    selectAll('heures', mapHeure),
    selectAll('punchlist', mapPunch),
  ])

  return {
    chantiers,
    taches,
    factures,
    equipe,
    rapports,
    messages,
    avenants,
    heures,
    punchlist,
  }
}

export async function insertChantier(f) {
  const row = {
    nom: f.nom || 'Nouveau',
    client: f.client || 'Client',
    tel: f.tel || '',
    corps: f.corps || '',
    statut: 'en_attente',
    avancement: 0,
    budget: parseInt(f.budget, 10) || 0,
    depenses: 0,
    debut: f.debut || null,
    fin: f.fin || null,
    equipe: [],
    priorite: f.priorite || 'normale',
    note: f.note || '',
    adresse: f.adresse || '',
    meteo: '📋',
  }
  const { data, error } = await supabase.from('chantiers').insert(row).select().single()
  throwIfError(error)
  return mapChantier(data)
}

export async function updateChantier(id, key, value) {
  const colMap = { chantierId: 'chantier_id' }
  const col = colMap[key] ?? key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
  const payload = { [col]: value }
  const { data, error } = await supabase.from('chantiers').update(payload).eq('id', id).select().single()
  throwIfError(error)
  return mapChantier(data)
}

export async function insertTache(f) {
  const row = {
    chantier_id: parseInt(f.chantierId, 10) || 0,
    titre: f.titre || 'Tâche',
    responsable: f.responsable || '',
    debut: f.debut || null,
    fin: f.fin || null,
    statut: f.statut || 'a_faire',
    duree: Math.max(1, f.duree || 1),
    priorite: f.priorite || 'normale',
  }
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

export async function insertRapport(f) {
  const row = {
    chantier_id: parseInt(f.chantierId, 10) || 0,
    date: f.date || null,
    auteur: f.auteur || '',
    meteo: f.meteo || '☀️',
    temperature: f.temperature || '',
    avancement: f.avancement || '',
    problemes: f.problemes || 'RAS',
    presences: f.presences || [],
    photos: 0,
  }
  const { data, error } = await supabase.from('rapports').insert(row).select().single()
  throwIfError(error)
  return mapRapport(data)
}

export async function insertMessage(m) {
  const row = {
    chantier_id: m.chantierId,
    auteur: m.auteur,
    role: m.role || '',
    texte: m.texte,
    heure: m.heure || '',
    date: m.date || null,
  }
  const { data, error } = await supabase.from('messages').insert(row).select().single()
  throwIfError(error)
  return mapMessage(data)
}

export async function insertAvenant(f) {
  const row = {
    chantier_id: parseInt(f.chantierId, 10) || 0,
    titre: f.titre || '',
    description: f.description || '',
    montant: parseInt(f.montant, 10) || 0,
    statut: 'en_attente',
    date_creation: new Date().toISOString().split('T')[0],
    date_validation: null,
    valide_par: '',
  }
  const { data, error } = await supabase.from('avenants').insert(row).select().single()
  throwIfError(error)
  return mapAvenant(data)
}

export async function updateAvenant(id, statut, validePar) {
  const row = {
    statut,
    valide_par: validePar,
    date_validation: new Date().toISOString().split('T')[0],
  }
  const { data, error } = await supabase.from('avenants').update(row).eq('id', id).select().single()
  throwIfError(error)
  return mapAvenant(data)
}

export async function updateHeure(id, valideePar) {
  const row = { valide: true, validee_par: valideePar }
  const { data, error } = await supabase.from('heures').update(row).eq('id', id).select().single()
  throwIfError(error)
  return mapHeure(data)
}

export async function insertPunchItem(f) {
  const row = {
    chantier_id: parseInt(f.chantierId, 10) || 0,
    titre: f.titre || '',
    description: f.description || '',
    categorie: f.categorie || 'Autre',
    priorite: f.priorite || 'normale',
    statut: f.statut || 'ouvert',
    signale_par: f.signalePar || '',
    date_signalement: f.dateSignalement || new Date().toISOString().split('T')[0],
    date_resolution: null,
    assigne_a: f.assigneA || '',
    photos: 0,
  }
  const { data, error } = await supabase.from('punchlist').insert(row).select().single()
  throwIfError(error)
  return mapPunch(data)
}

export async function updatePunchStatut(id, statut) {
  const row = {
    statut,
    date_resolution: statut === 'resolu' ? new Date().toISOString().split('T')[0] : null,
  }
  const { data, error } = await supabase.from('punchlist').update(row).eq('id', id).select().single()
  throwIfError(error)
  return mapPunch(data)
}
