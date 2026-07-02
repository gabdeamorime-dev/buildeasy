import { fetchAllData } from './db.js'

const PRIO_NUM = { haute: 1, normale: 2, basse: 3 }
const CH_STATUT = { en_cours: 'actif', termine: 'livre', en_attente: 'planif' }
const TACHE_STATUT = { a_faire: 'planif', en_cours: 'en_cours', fait: 'fait' }
const FAC_STATUT = { payee: 'encaissee', en_attente: 'emise', emise: 'emise', en_retard: 'retard', brouillon: 'emise' }
const AV_STATUT = { en_attente: 'attente', accepte: 'signe', refuse: 'refuse' }
const PUNCH_STATUT = { ouvert: 'ouvert', en_cours: 'encours', resolu: 'clos' }
const CMD_STATUT = { attente: 'attente', commandee: 'commandee', livree: 'livree' }

const fmtDate = (v) => {
  if (!v) return ''
  const s = String(v)
  if (/^\d{2}\/\d{2}/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('fr-FR')
}

export function toChantier(r) {
  return {
    id: r.id, nom: r.nom, client: r.client, tel: r.tel ?? '', corps: r.corps ?? '',
    statut: CH_STATUT[r.statut] ?? r.statut ?? 'planif', av: r.avancement ?? 0, budget: r.budget ?? 0, dep: r.depenses ?? 0,
    debut: fmtDate(r.debut), fin: fmtDate(r.fin), rdv: r.rdv ?? '', meteo: r.meteo ?? '—',
    prio: PRIO_NUM[r.priorite] ?? 2, note: r.note ?? '', adresse: r.adresse ?? '',
    taux: r.taux_h ?? 35, equipe: Array.isArray(r.equipe) ? r.equipe : [],
  }
}

export function toTache(r) {
  return {
    id: r.id, chId: r.chantierId, titre: r.titre, resp: r.responsable ?? '',
    debut: fmtDate(r.debut), fin: fmtDate(r.fin), statut: TACHE_STATUT[r.statut] ?? r.statut ?? 'planif',
    prio: PRIO_NUM[r.priorite] ?? 2, duree: r.duree ?? 1,
  }
}

export function toFacture(r) {
  return {
    id: r.id, chId: r.chantierId, client: r.client ?? '', mt: r.montant ?? 0,
    statut: FAC_STATUT[r.statut] ?? r.statut ?? 'emise', date: fmtDate(r.date), ech: fmtDate(r.echeance),
    desc: r.description || r.chantier || '',
  }
}

export function toMessage(r) {
  return {
    id: r.id, chId: r.chantierId, auteur: r.auteur, role: r.role ?? '', txt: r.texte ?? '', h: r.heure ?? '', d: fmtDate(r.date),
    type: r.type ?? 'text', attachments: Array.isArray(r.attachments) ? r.attachments : [], clientId: r.clientId ?? null,
    pending: false,
  }
}

export function toAvenant(r) {
  return {
    id: r.id, chId: r.chantierId, ref: r.ref || `AV-${String(r.id).padStart(3, '0')}`,
    titre: r.titre, desc: r.description ?? '', mt: r.montant ?? 0,
    statut: AV_STATUT[r.statut] ?? r.statut ?? 'attente', dc: fmtDate(r.dateCreation), ds: fmtDate(r.dateValidation), par: r.validePar ?? '',
  }
}

export function toHeure(r) {
  return {
    id: r.id, nom: r.membreNom ?? '', chId: r.chantierId, date: r.date ?? '', arr: r.arrivee ?? '', dep: r.depart ?? '',
    pause: r.pauseMin ?? 0, desc: r.description ?? '', val: Boolean(r.valide), panier: Boolean(r.panier),
    trajet: Boolean(r.trajet), zone: r.zone ?? 1,
  }
}

export function toPunch(r) {
  return {
    id: r.id, chId: r.chantierId, ref: `RES-${String(r.id).padStart(3, '0')}`, titre: r.titre, desc: r.description ?? '',
    corps: r.categorie ?? 'Autre', prio: PRIO_NUM[r.priorite] ?? 2, statut: PUNCH_STATUT[r.statut] ?? r.statut ?? 'ouvert',
    sig: r.signalePar ?? '', date: fmtDate(r.dateSignalement), clos: fmtDate(r.dateResolution), ass: r.assigneA ?? '',
  }
}

export function toRapport(r) {
  return {
    id: r.id, chId: r.chantierId, date: fmtDate(r.date), auteur: r.auteur ?? '', meteo: r.meteo ?? '',
    av: r.avancement ?? '', incidents: r.problemes ?? 'RAS', presences: Array.isArray(r.presences) ? r.presences : [],
  }
}

export function toEquipe(r) {
  return {
    id: r.id, nom: r.nom, fn: r.fn ?? r.role ?? '', tel: r.tel ?? '',
    chIds: Array.isArray(r.chantiers) ? r.chantiers : [], statut: r.statut_presence ?? (r.dispo ? 'present' : 'absent'),
    tauxH: r.taux_h ?? 35, qual: r.qual ?? 'N2',
  }
}

export function toDevis(r) {
  return {
    id: r.id, ref: r.ref ?? '', client: r.client ?? '', objet: r.objet ?? '',
    date: fmtDate(r.date), validite: fmtDate(r.validite), statut: r.statut ?? 'brouillon',
    lots: Array.isArray(r.lots) ? r.lots : [], remise: r.remise ?? 0, tva: r.tva ?? 20,
  }
}

export function toCommande(r) {
  return {
    id: r.id, chId: r.chantierId, ref: r.ref ?? '', fournisseur: r.fournisseur ?? '', objet: r.objet ?? '',
    mt: r.montant ?? 0, statut: CMD_STATUT[r.statut] ?? r.statut ?? 'attente',
    date: fmtDate(r.date), livraison: fmtDate(r.livraison), validePar: r.validePar ?? '',
  }
}

export function toIncident(r) {
  return {
    id: r.id, chId: r.chantierId, ref: r.ref ?? `INC-${String(r.id).padStart(3, '0')}`,
    type: r.type ?? 'autre', desc: r.description ?? '', prio: r.priorite ?? 2, statut: r.statut ?? 'ouvert',
    sig: r.signalePar ?? '', date: r.date ?? '', screen: r.screen ?? 'home', ts: r.ts ?? Date.now(),
    refCmd: r.refCmd ?? null, fournisseurId: r.fournisseurId ?? null, bloquant: Boolean(r.bloquant),
  }
}

export function toClient(r) {
  return {
    id: r.id, nom: r.nom ?? '', tel: r.tel ?? '', email: r.email ?? '', adresse: r.adresse ?? '',
    statut: r.statut ?? 'prospect', ca: r.ca ?? 0, nbChantiers: r.nbChantiers ?? 0, note: r.note ?? '',
  }
}

export function toSituation(r) {
  return {
    id: r.id, chId: r.chantierId, ref: r.ref ?? '', num: r.num ?? 1, titre: r.titre ?? '',
    av: r.avancement ?? 0, mt: r.montant ?? 0, statut: r.statut ?? 'emise',
    date: fmtDate(r.date), ech: fmtDate(r.echeance), desc: r.description ?? '',
  }
}

export function toPlanningEq(r) {
  return { id: r.membreId ?? r.id, dbId: r.id, nom: r.nom ?? '', sem: Array.isArray(r.sem) ? r.sem : [] }
}

export function toConge(r) {
  return {
    id: r.id, nom: r.nom ?? '', type: r.type ?? 'conge', debut: r.debut ?? '', fin: r.fin ?? '',
    jours: r.jours ?? 1, statut: r.statut ?? 'attente', motif: r.motif ?? '',
  }
}

export function toAgenda(r) {
  return {
    id: r.id, chId: r.chantierId, date: r.date ?? '', heure: r.heure ?? '', titre: r.titre ?? '',
    type: r.type ?? 'reunion', duree: r.duree ?? 60, lieu: r.lieu ?? '',
  }
}

export function toNote(r) {
  return { id: r.id, chId: r.chantierId, auteur: r.auteur ?? '', txt: r.txt ?? '', ts: r.ts ?? Date.now(), date: r.date ?? '' }
}

export function toFournisseur(r) {
  return { id: r.id, nom: r.nom ?? '', tel: r.tel ?? '', cat: r.cat ?? 'materiaux', url: r.url ?? '' }
}

export function messageFromDbRow(row) {
  return toMessage({
    id: row.id,
    chantierId: row.chantier_id,
    auteur: row.auteur,
    role: row.role,
    texte: row.texte,
    heure: row.heure,
    date: row.date,
    type: row.type,
    attachments: row.attachments,
    clientId: row.client_id,
  })
}

/** Charge toutes les tables Supabase et les convertit au format UI App.jsx */
export async function loadAppDataForUi() {
  const raw = await fetchAllData()
  return {
    chantiers: raw.chantiers.map(toChantier),
    taches: raw.taches.map(toTache),
    factures: raw.factures.map(toFacture),
    messages: raw.messages.map(toMessage),
    avenants: raw.avenants.map(toAvenant),
    heures: raw.heures.map(toHeure),
    punch: raw.punchlist.map(toPunch),
    rapports: raw.rapports.map(toRapport),
    equipe: raw.equipe.map(toEquipe),
    devis: raw.devis.map(toDevis),
    commandes: raw.commandes.map(toCommande),
    incidents: raw.incidents.map(toIncident),
    clients: raw.clients.map(toClient),
    situations: raw.situations.map(toSituation),
    planningEq: raw.planning_equipe.length ? raw.planning_equipe.map(toPlanningEq) : raw.equipe.map((e) => ({
      id: e.id, nom: e.nom, sem: [{ j: 'Lun', chId: null }, { j: 'Mar', chId: null }, { j: 'Mer', chId: null }, { j: 'Jeu', chId: null }, { j: 'Ven', chId: null }],
    })),
    conges: raw.conges.map(toConge),
    agenda: raw.agenda.map(toAgenda),
    notes: raw.notes_chantier.map(toNote),
    fournisseurs: raw.fournisseurs.map(toFournisseur),
  }
}
