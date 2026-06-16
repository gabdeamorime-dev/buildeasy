/**
 * Sync SaaS vers Supabase — source de vérité pour comptes cloud.
 */
import { isSupabaseConfigured } from '../supabase.js'
import * as db from './db.js'
import {
  toChantier, toTache, toAvenant, toPunch, toMessage, toRapport, toFacture,
  toDevis, toCommande, toIncident, toClient, toSituation, toConge, toAgenda, toNote, toFournisseur, toHeure,
} from './appDataBridge.js'

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

export async function cloudInsertChantier(f, user) {
  const row = await db.insertChantier({
    nom: f.nom, client: f.client, tel: f.tel, corps: f.corps, budget: f.budget,
    debut: frToIso(f.debut), fin: frToIso(f.fin), note: f.note, adresse: f.adresse,
    priorite: PRIO_DB[f.prio] || 'normale', statut: 'en_cours', rdv: f.rdv, taux_h: f.taux || 35,
  }, org(user))
  return toChantier(row)
}

export async function cloudUpdateChantier(id, patch) {
  const dbPatch = {}
  if (patch.av != null) dbPatch.avancement = patch.av
  if (patch.dep != null) dbPatch.depenses = patch.dep
  if (patch.statut) dbPatch.statut = CH_UI_DB[patch.statut] || patch.statut
  if (patch.nom) dbPatch.nom = patch.nom
  if (patch.budget != null) dbPatch.budget = patch.budget
  for (const [k, v] of Object.entries(dbPatch)) await db.updateChantier(id, k, v)
}

// ── Tâches ────────────────────────────────────────────────────────

export async function cloudInsertTache(f, user) {
  const row = await db.insertTache({
    chantierId: f.chId, titre: f.titre, responsable: f.resp, debut: frToIso(f.debut), fin: frToIso(f.fin),
    statut: TACHE_UI_DB[f.statut] || 'a_faire', duree: f.duree, priorite: PRIO_DB[f.prio] || 'normale',
  }, org(user))
  return toTache(row)
}

export async function cloudUpdateTache(id, key, value) {
  const map = { chId: 'chantier_id', resp: 'responsable', statut: 'statut', prio: 'priorite' }
  let v = value
  if (key === 'statut') v = TACHE_UI_DB[value] || value
  if (key === 'prio') v = PRIO_DB[value] || 'normale'
  if (key === 'chId') { await db.updateTache(id, 'chantier_id', value); return }
  await db.updateTache(id, map[key] || key, v)
}

// ── Avenants / Punch / Messages / Rapports / Factures / Heures ─────

export async function cloudInsertAvenant(f, user) {
  const row = await db.insertAvenant({ chantierId: f.chId, titre: f.titre, description: f.desc, montant: f.mt, ref: f.ref }, org(user))
  return toAvenant(row)
}

export async function cloudUpdateAvenant(id, statut, par) {
  const row = await db.updateAvenant(id, AV_UI_DB[statut] || statut, par)
  return toAvenant(row)
}

export async function cloudInsertPunch(f, user) {
  const row = await db.insertPunchItem({
    chantierId: f.chId, titre: f.titre, description: f.desc, categorie: f.corps,
    priorite: PRIO_DB[f.prio] || 'normale', statut: PUNCH_UI_DB[f.statut] || 'ouvert', signalePar: f.sig || f.ass, assigneA: f.ass,
  }, org(user))
  return toPunch(row)
}

export async function cloudUpdatePunch(id, statut) {
  const row = await db.updatePunchStatut(id, PUNCH_UI_DB[statut] || statut)
  return toPunch(row)
}

export async function cloudInsertMessage(m, user) {
  const row = await db.insertMessage({ chantierId: m.chId, auteur: m.auteur, role: m.role, texte: m.txt, heure: m.h, date: frToIso(m.d) }, org(user))
  return toMessage(row)
}

export async function cloudInsertRapport(f, user) {
  const row = await db.insertRapport({
    chantierId: f.chId, date: frToIso(f.date), auteur: f.auteur, meteo: f.meteo, avancement: f.av, problemes: f.incidents, presences: f.presences,
  }, org(user))
  return toRapport(row)
}

export async function cloudInsertFacture(f, user) {
  const row = await db.insertFacture({
    id: f.id, chantierId: f.chId, client: f.client, montant: f.mt, statut: FAC_UI_DB[f.statut] || 'emise',
    date: frToIso(f.date), echeance: frToIso(f.ech), description: f.desc,
  }, org(user))
  return toFacture(row)
}

export async function cloudUpdateFactureStatut(id, statut) {
  const row = await db.updateFactureStatut(id, FAC_UI_DB[statut] || statut)
  return toFacture(row)
}

export async function cloudInsertHeure(h, user) {
  const row = await db.insertHeure({
    chantierId: h.chId, membreNom: h.nom, arrivee: h.arr, depart: h.dep, pauseMin: h.pause,
    description: h.desc, panier: h.panier, trajet: h.trajet, zone: h.zone, date: frToIso(h.date),
  }, org(user))
  return toHeure(row)
}

export async function cloudValidateHeure(id, par) {
  await db.updateHeure(id, par)
}

// ── Devis ─────────────────────────────────────────────────────────

export async function cloudInsertDevis(d, user) {
  const row = await db.insertDevis({
    ref: d.ref, client: d.client, objet: d.objet, date: frToIso(d.date), validite: frToIso(d.validite),
    statut: d.statut || 'brouillon', lots: d.lots || [], remise: d.remise, tva: d.tva,
  }, org(user))
  return toDevis(row)
}

export async function cloudUpdateDevisStatut(id, statut) {
  const row = await db.updateDevis(id, { statut })
  return toDevis(row)
}

export async function cloudUpdateDevis(id, changes) {
  const patch = {}
  if (changes.client) patch.client = changes.client
  if (changes.objet) patch.objet = changes.objet
  if (changes.lots) patch.lots = changes.lots
  if (changes.remise != null) patch.remise = changes.remise
  if (changes.statut) patch.statut = changes.statut
  const row = await db.updateDevis(id, patch)
  return toDevis(row)
}

// ── Commandes ─────────────────────────────────────────────────────

export async function cloudInsertCommande(c, user) {
  const row = await db.insertCommande({
    chantierId: c.chId, ref: c.ref, fournisseur: c.fournisseur, objet: c.objet, montant: c.mt,
    statut: CMD_UI_DB[c.statut] || 'attente', date: frToIso(c.date), livraison: frToIso(c.livraison), validePar: c.validePar,
  }, org(user))
  return toCommande(row)
}

export async function cloudUpdateCommande(id, patch) {
  const dbPatch = {}
  if (patch.statut) dbPatch.statut = CMD_UI_DB[patch.statut] || patch.statut
  if (patch.livraison) dbPatch.livraison = frToIso(patch.livraison)
  const row = await db.updateCommande(id, dbPatch)
  return toCommande(row)
}

// ── Incidents ─────────────────────────────────────────────────────

export async function cloudInsertIncident(f, user) {
  const row = await db.insertIncident({
    chantierId: f.chId, ref: f.ref, type: f.type, desc: f.desc, prio: f.prio, statut: f.statut || 'ouvert',
    sig: f.sig, date: f.date, screen: f.screen, ts: f.ts, refCmd: f.refCmd, fournisseurId: f.fournisseurId, bloquant: f.bloquant,
  }, org(user))
  return toIncident(row)
}

export async function cloudUpdateIncident(id, changes) {
  const patch = typeof changes === 'string' ? { statut: changes } : changes
  const row = await db.updateIncident(id, patch)
  return toIncident(row)
}

export async function cloudDeleteIncident(id) {
  await db.deleteIncident(id)
}

// ── Clients / Situations / Congés / Agenda / Notes / Fournisseurs ──

export async function cloudInsertClient(c, user) {
  const row = await db.insertClient(c, org(user))
  return toClient(row)
}

export async function cloudInsertSituation(f, user) {
  const row = await db.insertSituation({
    chantierId: f.chId, ref: f.ref, num: f.num, titre: f.titre, av: f.av, mt: f.mt,
    statut: f.statut, date: frToIso(f.date), ech: frToIso(f.ech), desc: f.desc,
  }, org(user))
  return toSituation(row)
}

export async function cloudUpdateSituationStatut(id, statut) {
  const row = await db.updateSituation(id, statut)
  return toSituation(row)
}

export async function cloudInsertConge(f, user) {
  const row = await db.insertConge(f, org(user))
  return toConge(row)
}

export async function cloudUpdateConge(id, statut) {
  const row = await db.updateConge(id, statut)
  return toConge(row)
}

export async function cloudInsertAgenda(f, user) {
  const row = await db.insertAgenda(f, org(user))
  return toAgenda(row)
}

export async function cloudDeleteAgenda(id) {
  await db.deleteAgenda(id)
}

export async function cloudInsertNote(n, user) {
  const row = await db.insertNote({ chantierId: n.chId, auteur: n.auteur, txt: n.txt, ts: n.ts, date: n.date }, org(user))
  return toNote(row)
}

export async function cloudDeleteNote(id) {
  await db.deleteNote(id)
}

export async function cloudInsertFournisseur(f, user) {
  const row = await db.insertFournisseur(f, org(user))
  return toFournisseur(row)
}

export async function cloudUpdateFournisseur(id, patch) {
  const row = await db.updateFournisseur(id, patch)
  return toFournisseur(row)
}

export async function cloudDeleteFournisseur(id) {
  await db.deleteFournisseur(id)
}

export async function cloudUpdatePlanningEq(membre, user) {
  await db.upsertPlanningEq(membre, org(user))
}

export async function cloudUpdateEquipeStatut(id, statut) {
  await db.updateEquipeStatut(id, statut)
}
