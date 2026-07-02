import { getInitialDemoData } from './demoData.js'

const nextId = (items) => Math.max(0, ...items.map((x) => Number(x.id) || 0)) + 1

export function createDemoStore() {
  const data = getInitialDemoData()

  return {
    getSnapshot() {
      return { ...data }
    },

    insertChantier(f) {
      const row = {
        id: nextId(data.chantiers),
        nom: f.nom || 'Nouveau',
        client: f.client || 'Client',
        tel: f.tel || '',
        corps: f.corps || '',
        statut: 'en_attente',
        avancement: 0,
        budget: parseInt(f.budget, 10) || 0,
        depenses: 0,
        debut: f.debut || '',
        fin: f.fin || '',
        equipe: [],
        priorite: f.priorite || 'normale',
        note: f.note || '',
        adresse: f.adresse || '',
        meteo: '—',
      }
      data.chantiers.push(row)
      return row
    },

    updateChantier(id, key, value) {
      const row = data.chantiers.find((c) => c.id === id)
      if (!row) throw new Error('Chantier introuvable')
      row[key] = value
      return { ...row }
    },

    insertTache(f) {
      const row = {
        id: nextId(data.taches),
        chantierId: parseInt(f.chantierId, 10) || 0,
        titre: f.titre || 'Tâche',
        responsable: f.responsable || '',
        debut: f.debut || '',
        fin: f.fin || '',
        statut: f.statut || 'a_faire',
        duree: Math.max(1, f.duree || 1),
        priorite: f.priorite || 'normale',
      }
      data.taches.push(row)
      return row
    },

    updateTache(id, key, value) {
      const row = data.taches.find((t) => t.id === id)
      if (!row) throw new Error('Tâche introuvable')
      row[key] = value
      return { ...row }
    },

    insertRapport(f) {
      const row = {
        id: nextId(data.rapports),
        chantierId: parseInt(f.chantierId, 10) || 0,
        date: f.date || '',
        auteur: f.auteur || '',
        meteo: f.meteo || 'Ensoleillé',
        temperature: f.temperature || '',
        avancement: f.avancement || '',
        problemes: f.problemes || 'RAS',
        presences: f.presences || [],
        photos: 0,
      }
      data.rapports.push(row)
      return row
    },

    insertMessage(m) {
      const row = {
        id: nextId(data.messages),
        chantierId: m.chantierId,
        auteur: m.auteur,
        role: m.role || '',
        texte: m.texte,
        heure: m.heure || '',
        date: m.date || '',
      }
      data.messages.push(row)
      return row
    },

    insertAvenant(f) {
      const row = {
        id: nextId(data.avenants),
        chantierId: parseInt(f.chantierId, 10) || 0,
        titre: f.titre || '',
        description: f.description || '',
        montant: parseInt(f.montant, 10) || 0,
        statut: 'en_attente',
        dateCreation: new Date().toISOString().split('T')[0],
        dateValidation: '',
        validePar: '',
      }
      data.avenants.push(row)
      return row
    },

    updateAvenant(id, statut, validePar) {
      const row = data.avenants.find((a) => a.id === id)
      if (!row) throw new Error('Avenant introuvable')
      row.statut = statut
      row.validePar = validePar
      row.dateValidation = new Date().toISOString().split('T')[0]
      return { ...row }
    },

    updateHeure(id, valideePar) {
      const row = data.heures.find((h) => h.id === id)
      if (!row) throw new Error('Heure introuvable')
      row.valide = true
      row.valideePar = valideePar
      return { ...row }
    },

    insertPunchItem(f) {
      const row = {
        id: nextId(data.punchlist),
        chantierId: parseInt(f.chantierId, 10) || 0,
        titre: f.titre || '',
        description: f.description || '',
        categorie: f.categorie || 'Autre',
        priorite: f.priorite || 'normale',
        statut: f.statut || 'ouvert',
        signalePar: f.signalePar || '',
        dateSignalement: f.dateSignalement || new Date().toISOString().split('T')[0],
        dateResolution: '',
        assigneA: f.assigneA || '',
        photos: 0,
      }
      data.punchlist.push(row)
      return row
    },

    updatePunchStatut(id, statut) {
      const row = data.punchlist.find((p) => p.id === id)
      if (!row) throw new Error('Réserve introuvable')
      row.statut = statut
      row.dateResolution = statut === 'resolu' ? new Date().toISOString().split('T')[0] : ''
      return { ...row }
    },
  }
}
