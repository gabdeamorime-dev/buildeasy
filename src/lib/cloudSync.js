/**
 * Sync SaaS vers Supabase — source de vérité pour comptes cloud.
 * Mode hors ligne : file d'attente locale, flush à la reconnexion.
 */
import { isSupabaseConfigured } from '../supabase.js'
import * as db from './db.js'
import * as syncQueue from './syncQueue.js'
import {
  toChantier, toTache, toAvenant, toPunch, toMessage, toRapport, toFacture,
  toDevis, toCommande, toIncident, toClient, toSituation, toConge, toAgenda, toNote, toFournisseur, toHeure,
} from './appDataBridge.js'
import { resolveMessageMedia } from './chantierMedia.js'

/** @type {{ online: boolean, user: object|null, onQueued: ((n: number) => void)|null }} */
let _gate = { online: true, user: null, onQueued: null }

export function configureOfflineGate({ online, user, onQueued }) {
  if (online !== undefined) _gate.online = online
  if (user !== undefined) _gate.user = user
  if (onQueued !== undefined) _gate.onQueued = onQueued
}

export function getPendingSyncCount(user) {
  return syncQueue.getPendingCount(user || _gate.user)
}

async function maybeQueue(type, payload, user, tempId, executor) {
  const u = user || _gate.user
  if (!shouldCloudSync(u)) return undefined
  if (!_gate.online) {
    syncQueue.enqueue(u, { type, payload, tempId })
    _gate.onQueued?.(syncQueue.getPendingCount(u))
    return undefined
  }
  try {
    return await executor()
  } catch {
    syncQueue.enqueue(u, { type, payload, tempId })
    _gate.onQueued?.(syncQueue.getPendingCount(u))
    return undefined
  }
}

const _exec = {
  insertChantier: (p, u) => cloudInsertChantierRaw(p, u),
  updateChantier: (p) => cloudUpdateChantierRaw(p.id, p.patch),
  insertTache: (p, u) => cloudInsertTacheRaw(p, u),
  updateTache: (p) => cloudUpdateTacheRaw(p.id, p.key, p.value),
  insertAvenant: (p, u) => cloudInsertAvenantRaw(p, u),
  updateAvenant: (p) => cloudUpdateAvenantRaw(p.id, p.statut, p.par),
  insertPunch: (p, u) => cloudInsertPunchRaw(p, u),
  updatePunch: (p) => cloudUpdatePunchRaw(p.id, p.statut),
  insertMessage: (p, u) => cloudInsertMessageRaw(p, u),
  insertRapport: (p, u) => cloudInsertRapportRaw(p, u),
  insertFacture: (p, u) => cloudInsertFactureRaw(p, u),
  updateFactureStatut: (p) => cloudUpdateFactureStatutRaw(p.id, p.statut),
  insertHeure: (p, u) => cloudInsertHeureRaw(p, u),
  validateHeure: (p) => cloudValidateHeureRaw(p.id, p.par),
  insertDevis: (p, u) => cloudInsertDevisRaw(p, u),
  updateDevisStatut: (p) => cloudUpdateDevisStatutRaw(p.id, p.statut),
  updateDevis: (p) => cloudUpdateDevisRaw(p.id, p.changes),
  insertCommande: (p, u) => cloudInsertCommandeRaw(p, u),
  updateCommande: (p) => cloudUpdateCommandeRaw(p.id, p.patch),
  insertIncident: (p, u) => cloudInsertIncidentRaw(p, u),
  updateIncident: (p) => cloudUpdateIncidentRaw(p.id, p.changes),
  deleteIncident: (p) => cloudDeleteIncidentRaw(p.id),
  insertClient: (p, u) => cloudInsertClientRaw(p, u),
  insertSituation: (p, u) => cloudInsertSituationRaw(p, u),
  updateSituationStatut: (p) => cloudUpdateSituationStatutRaw(p.id, p.statut),
  insertConge: (p, u) => cloudInsertCongeRaw(p, u),
  updateConge: (p) => cloudUpdateCongeRaw(p.id, p.statut),
  insertAgenda: (p, u) => cloudInsertAgendaRaw(p, u),
  deleteAgenda: (p) => cloudDeleteAgendaRaw(p.id),
  insertNote: (p, u) => cloudInsertNoteRaw(p, u),
  deleteNote: (p) => cloudDeleteNoteRaw(p.id),
  insertFournisseur: (p, u) => cloudInsertFournisseurRaw(p, u),
  updateFournisseur: (p) => cloudUpdateFournisseurRaw(p.id, p.patch),
  deleteFournisseur: (p) => cloudDeleteFournisseurRaw(p.id),
  updatePlanningEq: (p, u) => cloudUpdatePlanningEqRaw(p.membre, u),
  updateEquipeStatut: (p) => cloudUpdateEquipeStatutRaw(p.id, p.statut),
}

/** @returns {Promise<Array<{ type: string, tempId: number|null, result: unknown }>>} */
export async function flushOfflineQueue(user) {
  const u = user || _gate.user
  if (!shouldCloudSync(u)) return []
  const remaps = []
  const items = syncQueue.peekAll(u)
  for (const item of items) {
    if ((item.retries || 0) >= 5) continue
    const run = _exec[item.type]
    if (!run) {
      syncQueue.remove(u, item.id)
      continue
    }
    try {
      const payload = item.payload
      const needsUser = ['insertChantier', 'insertTache', 'insertAvenant', 'insertPunch', 'insertMessage',
        'insertRapport', 'insertFacture', 'insertHeure', 'insertDevis', 'insertCommande', 'insertIncident',
        'insertClient', 'insertSituation', 'insertConge', 'insertAgenda', 'insertNote', 'insertFournisseur',
        'updatePlanningEq'].includes(item.type)
      const result = needsUser ? await run(payload, u) : await run(payload)
      syncQueue.remove(u, item.id)
      remaps.push({ type: item.type, tempId: item.tempId, result })
    } catch {
      syncQueue.incrementRetry(u, item.id)
      break
    }
  }
  syncQueue.dropFailed(u)
  return remaps
}

const PRIO_DB = { 1: 'haute', 2: 'normale', 3: 'basse' }
const CH_UI_DB = { actif: 'en_cours', livre: 'termine', planif: 'en_attente' }
const AV_UI_DB = { attente: 'en_attente', signe: 'accepte', refuse: 'refuse' }
const PUNCH_UI_DB = { ouvert: 'ouvert', encours: 'en_cours', clos: 'resolu' }
const TACHE_UI_DB = { planif: 'a_faire', en_cours: 'en_cours', fait: 'fait' }
const FAC_UI_DB = { encaissee: 'payee', emise: 'emise', retard: 'en_retard' }
const CMD_UI_DB = { attente: 'attente', commandee: 'commandee', livree: 'livree' }

function frToIso(d) {
  if (!d) return null
  const p = String(d).split('/')
  if (p.length === 3) {
    let y = parseInt(p[2], 10)
    if (y < 100) y += 2000
    return `${y}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`
  }
  return d
}

function org(user) {
  return user?.orgId ?? null
}

export function shouldCloudSync(user) {
  return Boolean(user?.isSupabase && isSupabaseConfigured)
}

// ── Chantiers ─────────────────────────────────────────────────────

async function cloudInsertChantierRaw(f, user) {
  const row = await db.insertChantier({
    nom: f.nom, client: f.client, tel: f.tel, corps: f.corps, budget: f.budget,
    debut: frToIso(f.debut), fin: frToIso(f.fin), note: f.note, adresse: f.adresse,
    priorite: PRIO_DB[f.prio] || 'normale', statut: 'en_cours', rdv: f.rdv, taux_h: f.taux || 35,
  }, org(user))
  return toChantier(row)
}

export async function cloudInsertChantier(f, user) {
  return maybeQueue('insertChantier', f, user, f.id, () => cloudInsertChantierRaw(f, user))
}

async function cloudUpdateChantierRaw(id, patch) {
  const dbPatch = {}
  if (patch.av != null) dbPatch.avancement = patch.av
  if (patch.dep != null) dbPatch.depenses = patch.dep
  if (patch.statut) dbPatch.statut = CH_UI_DB[patch.statut] || patch.statut
  if (patch.nom) dbPatch.nom = patch.nom
  if (patch.budget != null) dbPatch.budget = patch.budget
  for (const [k, v] of Object.entries(dbPatch)) await db.updateChantier(id, k, v)
}

export async function cloudUpdateChantier(id, patch) {
  return maybeQueue('updateChantier', { id, patch }, _gate.user, null, () => cloudUpdateChantierRaw(id, patch))
}

// ── Tâches ────────────────────────────────────────────────────────

async function cloudInsertTacheRaw(f, user) {
  const row = await db.insertTache({
    chantierId: f.chId, titre: f.titre, responsable: f.resp, debut: frToIso(f.debut), fin: frToIso(f.fin),
    statut: TACHE_UI_DB[f.statut] || 'a_faire', duree: f.duree, priorite: PRIO_DB[f.prio] || 'normale',
  }, org(user))
  return toTache(row)
}

export async function cloudInsertTache(f, user) {
  return maybeQueue('insertTache', f, user, f.id, () => cloudInsertTacheRaw(f, user))
}

async function cloudUpdateTacheRaw(id, key, value) {
  const map = { chId: 'chantier_id', resp: 'responsable', statut: 'statut', prio: 'priorite' }
  let v = value
  if (key === 'statut') v = TACHE_UI_DB[value] || value
  if (key === 'prio') v = PRIO_DB[value] || 'normale'
  if (key === 'chId') { await db.updateTache(id, 'chantier_id', value); return }
  await db.updateTache(id, map[key] || key, v)
}

export async function cloudUpdateTache(id, key, value) {
  return maybeQueue('updateTache', { id, key, value }, _gate.user, null, () => cloudUpdateTacheRaw(id, key, value))
}

// ── Avenants / Punch / Messages / Rapports / Factures / Heures ─────

async function cloudInsertAvenantRaw(f, user) {
  const row = await db.insertAvenant({ chantierId: f.chId, titre: f.titre, description: f.desc, montant: f.mt, ref: f.ref }, org(user))
  return toAvenant(row)
}

export async function cloudInsertAvenant(f, user) {
  return maybeQueue('insertAvenant', f, user, f.id, () => cloudInsertAvenantRaw(f, user))
}

async function cloudUpdateAvenantRaw(id, statut, par) {
  const row = await db.updateAvenant(id, AV_UI_DB[statut] || statut, par)
  return toAvenant(row)
}

export async function cloudUpdateAvenant(id, statut, par) {
  return maybeQueue('updateAvenant', { id, statut, par }, _gate.user, null, () => cloudUpdateAvenantRaw(id, statut, par))
}

async function cloudInsertPunchRaw(f, user) {
  const row = await db.insertPunchItem({
    chantierId: f.chId, titre: f.titre, description: f.desc, categorie: f.corps,
    priorite: PRIO_DB[f.prio] || 'normale', statut: PUNCH_UI_DB[f.statut] || 'ouvert', signalePar: f.sig || f.ass, assigneA: f.ass,
  }, org(user))
  return toPunch(row)
}

export async function cloudInsertPunch(f, user) {
  return maybeQueue('insertPunch', f, user, f.id, () => cloudInsertPunchRaw(f, user))
}

async function cloudUpdatePunchRaw(id, statut) {
  const row = await db.updatePunchStatut(id, PUNCH_UI_DB[statut] || statut)
  return toPunch(row)
}

export async function cloudUpdatePunch(id, statut) {
  return maybeQueue('updatePunch', { id, statut }, _gate.user, null, () => cloudUpdatePunchRaw(id, statut))
}

async function cloudInsertMessageRaw(m, user) {
  const media = await resolveMessageMedia(m, org(user))
  const row = await db.insertMessage({
    chantierId: m.chId,
    auteur: m.auteur,
    role: m.role,
    texte: m.txt || '',
    heure: m.h,
    date: frToIso(m.d),
    type: media.type,
    attachments: media.attachments,
    clientId: m.clientId || m.mediaClientId || null,
  }, org(user))
  return { ...toMessage(row), localPreview: null, mediaClientId: null, pending: false }
}

export async function cloudInsertMessage(m, user) {
  return maybeQueue('insertMessage', m, user, m.id, () => cloudInsertMessageRaw(m, user))
}

async function cloudInsertRapportRaw(f, user) {
  const row = await db.insertRapport({
    chantierId: f.chId, date: frToIso(f.date), auteur: f.auteur, meteo: f.meteo, avancement: f.av, problemes: f.incidents, presences: f.presences,
  }, org(user))
  return toRapport(row)
}

export async function cloudInsertRapport(f, user) {
  return maybeQueue('insertRapport', f, user, f.id, () => cloudInsertRapportRaw(f, user))
}

async function cloudInsertFactureRaw(f, user) {
  const row = await db.insertFacture({
    id: f.id, chantierId: f.chId, client: f.client, montant: f.mt, statut: FAC_UI_DB[f.statut] || 'emise',
    date: frToIso(f.date), echeance: frToIso(f.ech), description: f.desc,
  }, org(user))
  return toFacture(row)
}

export async function cloudInsertFacture(f, user) {
  return maybeQueue('insertFacture', f, user, f.id, () => cloudInsertFactureRaw(f, user))
}

async function cloudUpdateFactureStatutRaw(id, statut) {
  const row = await db.updateFactureStatut(id, FAC_UI_DB[statut] || statut)
  return toFacture(row)
}

export async function cloudUpdateFactureStatut(id, statut) {
  return maybeQueue('updateFactureStatut', { id, statut }, _gate.user, null, () => cloudUpdateFactureStatutRaw(id, statut))
}

async function cloudInsertHeureRaw(h, user) {
  const row = await db.insertHeure({
    chantierId: h.chId, membreNom: h.nom, arrivee: h.arr, depart: h.dep, pauseMin: h.pause,
    description: h.desc, panier: h.panier, trajet: h.trajet, zone: h.zone, date: frToIso(h.date),
  }, org(user))
  return toHeure(row)
}

export async function cloudInsertHeure(h, user) {
  return maybeQueue('insertHeure', h, user, h.id, () => cloudInsertHeureRaw(h, user))
}

async function cloudValidateHeureRaw(id, par) {
  await db.updateHeure(id, par)
}

export async function cloudValidateHeure(id, par) {
  return maybeQueue('validateHeure', { id, par }, _gate.user, null, () => cloudValidateHeureRaw(id, par))
}

// ── Devis ─────────────────────────────────────────────────────────

async function cloudInsertDevisRaw(d, user) {
  const row = await db.insertDevis({
    ref: d.ref, client: d.client, objet: d.objet, date: frToIso(d.date), validite: frToIso(d.validite),
    statut: d.statut || 'brouillon', lots: d.lots || [], remise: d.remise, tva: d.tva,
  }, org(user))
  return toDevis(row)
}

export async function cloudInsertDevis(d, user) {
  return maybeQueue('insertDevis', d, user, d.id, () => cloudInsertDevisRaw(d, user))
}

async function cloudUpdateDevisStatutRaw(id, statut) {
  const row = await db.updateDevis(id, { statut })
  return toDevis(row)
}

export async function cloudUpdateDevisStatut(id, statut) {
  return maybeQueue('updateDevisStatut', { id, statut }, _gate.user, null, () => cloudUpdateDevisStatutRaw(id, statut))
}

async function cloudUpdateDevisRaw(id, changes) {
  const patch = {}
  if (changes.client) patch.client = changes.client
  if (changes.objet) patch.objet = changes.objet
  if (changes.lots) patch.lots = changes.lots
  if (changes.remise != null) patch.remise = changes.remise
  if (changes.statut) patch.statut = changes.statut
  const row = await db.updateDevis(id, patch)
  return toDevis(row)
}

export async function cloudUpdateDevis(id, changes) {
  return maybeQueue('updateDevis', { id, changes }, _gate.user, null, () => cloudUpdateDevisRaw(id, changes))
}

// ── Commandes ─────────────────────────────────────────────────────

async function cloudInsertCommandeRaw(c, user) {
  const row = await db.insertCommande({
    chantierId: c.chId, ref: c.ref, fournisseur: c.fournisseur, objet: c.objet, montant: c.mt,
    statut: CMD_UI_DB[c.statut] || 'attente', date: frToIso(c.date), livraison: frToIso(c.livraison), validePar: c.validePar,
  }, org(user))
  return toCommande(row)
}

export async function cloudInsertCommande(c, user) {
  return maybeQueue('insertCommande', c, user, c.id, () => cloudInsertCommandeRaw(c, user))
}

async function cloudUpdateCommandeRaw(id, patch) {
  const dbPatch = {}
  if (patch.statut) dbPatch.statut = CMD_UI_DB[patch.statut] || patch.statut
  if (patch.livraison) dbPatch.livraison = frToIso(patch.livraison)
  const row = await db.updateCommande(id, dbPatch)
  return toCommande(row)
}

export async function cloudUpdateCommande(id, patch) {
  return maybeQueue('updateCommande', { id, patch }, _gate.user, null, () => cloudUpdateCommandeRaw(id, patch))
}

// ── Incidents ─────────────────────────────────────────────────────

async function cloudInsertIncidentRaw(f, user) {
  const row = await db.insertIncident({
    chantierId: f.chId, ref: f.ref, type: f.type, desc: f.desc, prio: f.prio, statut: f.statut || 'ouvert',
    sig: f.sig, date: f.date, screen: f.screen, ts: f.ts, refCmd: f.refCmd, fournisseurId: f.fournisseurId, bloquant: f.bloquant,
  }, org(user))
  return toIncident(row)
}

export async function cloudInsertIncident(f, user) {
  return maybeQueue('insertIncident', f, user, f.id, () => cloudInsertIncidentRaw(f, user))
}

async function cloudUpdateIncidentRaw(id, changes) {
  const patch = typeof changes === 'string' ? { statut: changes } : changes
  const row = await db.updateIncident(id, patch)
  return toIncident(row)
}

export async function cloudUpdateIncident(id, changes) {
  return maybeQueue('updateIncident', { id, changes }, _gate.user, null, () => cloudUpdateIncidentRaw(id, changes))
}

async function cloudDeleteIncidentRaw(id) {
  await db.deleteIncident(id)
}

export async function cloudDeleteIncident(id) {
  return maybeQueue('deleteIncident', { id }, _gate.user, null, () => cloudDeleteIncidentRaw(id))
}

// ── Clients / Situations / Congés / Agenda / Notes / Fournisseurs ──

async function cloudInsertClientRaw(c, user) {
  const row = await db.insertClient(c, org(user))
  return toClient(row)
}

export async function cloudInsertClient(c, user) {
  return maybeQueue('insertClient', c, user, c.id, () => cloudInsertClientRaw(c, user))
}

async function cloudInsertSituationRaw(f, user) {
  const row = await db.insertSituation({
    chantierId: f.chId, ref: f.ref, num: f.num, titre: f.titre, av: f.av, mt: f.mt,
    statut: f.statut, date: frToIso(f.date), ech: frToIso(f.ech), desc: f.desc,
  }, org(user))
  return toSituation(row)
}

export async function cloudInsertSituation(f, user) {
  return maybeQueue('insertSituation', f, user, f.id, () => cloudInsertSituationRaw(f, user))
}

async function cloudUpdateSituationStatutRaw(id, statut) {
  const row = await db.updateSituation(id, statut)
  return toSituation(row)
}

export async function cloudUpdateSituationStatut(id, statut) {
  return maybeQueue('updateSituationStatut', { id, statut }, _gate.user, null, () => cloudUpdateSituationStatutRaw(id, statut))
}

async function cloudInsertCongeRaw(f, user) {
  const row = await db.insertConge(f, org(user))
  return toConge(row)
}

export async function cloudInsertConge(f, user) {
  return maybeQueue('insertConge', f, user, f.id, () => cloudInsertCongeRaw(f, user))
}

async function cloudUpdateCongeRaw(id, statut) {
  const row = await db.updateConge(id, statut)
  return toConge(row)
}

export async function cloudUpdateConge(id, statut) {
  return maybeQueue('updateConge', { id, statut }, _gate.user, null, () => cloudUpdateCongeRaw(id, statut))
}

async function cloudInsertAgendaRaw(f, user) {
  const row = await db.insertAgenda(f, org(user))
  return toAgenda(row)
}

export async function cloudInsertAgenda(f, user) {
  return maybeQueue('insertAgenda', f, user, f.id, () => cloudInsertAgendaRaw(f, user))
}

async function cloudDeleteAgendaRaw(id) {
  await db.deleteAgenda(id)
}

export async function cloudDeleteAgenda(id) {
  return maybeQueue('deleteAgenda', { id }, _gate.user, null, () => cloudDeleteAgendaRaw(id))
}

async function cloudInsertNoteRaw(n, user) {
  const row = await db.insertNote({ chantierId: n.chId, auteur: n.auteur, txt: n.txt, ts: n.ts, date: n.date }, org(user))
  return toNote(row)
}

export async function cloudInsertNote(n, user) {
  return maybeQueue('insertNote', n, user, n.id, () => cloudInsertNoteRaw(n, user))
}

async function cloudDeleteNoteRaw(id) {
  await db.deleteNote(id)
}

export async function cloudDeleteNote(id) {
  return maybeQueue('deleteNote', { id }, _gate.user, null, () => cloudDeleteNoteRaw(id))
}

async function cloudInsertFournisseurRaw(f, user) {
  const row = await db.insertFournisseur(f, org(user))
  return toFournisseur(row)
}

export async function cloudInsertFournisseur(f, user) {
  return maybeQueue('insertFournisseur', f, user, f.id, () => cloudInsertFournisseurRaw(f, user))
}

async function cloudUpdateFournisseurRaw(id, patch) {
  const row = await db.updateFournisseur(id, patch)
  return toFournisseur(row)
}

export async function cloudUpdateFournisseur(id, patch) {
  return maybeQueue('updateFournisseur', { id, patch }, _gate.user, null, () => cloudUpdateFournisseurRaw(id, patch))
}

async function cloudDeleteFournisseurRaw(id) {
  await db.deleteFournisseur(id)
}

export async function cloudDeleteFournisseur(id) {
  return maybeQueue('deleteFournisseur', { id }, _gate.user, null, () => cloudDeleteFournisseurRaw(id))
}

async function cloudUpdatePlanningEqRaw(membre, user) {
  await db.upsertPlanningEq(membre, org(user))
}

export async function cloudUpdatePlanningEq(membre, user) {
  return maybeQueue('updatePlanningEq', { membre }, user, null, () => cloudUpdatePlanningEqRaw(membre, user))
}

async function cloudUpdateEquipeStatutRaw(id, statut) {
  await db.updateEquipeStatut(id, statut)
}

export async function cloudUpdateEquipeStatut(id, statut) {
  return maybeQueue('updateEquipeStatut', { id, statut }, _gate.user, null, () => cloudUpdateEquipeStatutRaw(id, statut))
}
