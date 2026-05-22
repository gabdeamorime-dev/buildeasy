/** Données et comptes de démo — mode local sans Supabase */

export const DEMO_ACCOUNTS = [
  { nom: 'Jean Dupont', role: 'admin', email: 'admin@buildeasy.eu', password: 'admin123', chantierIds: [] },
  { nom: 'Marc Lefebvre', role: 'chef', email: 'chef@buildeasy.eu', password: 'chef123', chantierIds: [1, 5] },
  { nom: 'Ali Benali', role: 'employe', email: 'ali@buildeasy.eu', password: 'employe123', chantierIds: [1] },
  { nom: 'M. Dupont Client', role: 'client', email: 'client@buildeasy.eu', password: 'client123', chantierIds: [1] },
]

export function findDemoAccount(email, password) {
  const normalized = email.trim().toLowerCase()
  return DEMO_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === normalized && a.password === password
  )
}

export function demoAccountToUser(account) {
  return {
    id: account.email,
    nom: account.nom,
    role: account.role,
    email: account.email,
    chantierIds: account.chantierIds,
  }
}

export function getInitialDemoData() {
  return {
    chantiers: [
      { id: 1, nom: 'Rénovation Villa Dupont', client: 'M. Dupont', tel: '06 11 22 33 44', corps: 'Maçonnerie + Plomberie', statut: 'en_cours', avancement: 68, budget: 85000, depenses: 62400, debut: '2026-03-10', fin: '2026-06-30', equipe: ['Jean', 'Marc', 'Ali'], priorite: 'haute', note: 'Attention délai façade', adresse: '12 rue des Roses, Paris 16e', meteo: '☀️' },
      { id: 2, nom: 'Extension Pavillon Martin', client: 'Mme Martin', tel: '06 22 33 44 55', corps: 'Gros Œuvre', statut: 'en_cours', avancement: 34, budget: 120000, depenses: 41800, debut: '2026-04-01', fin: '2026-09-15', equipe: ['Karim', 'Sébastien'], priorite: 'normale', note: '', adresse: '8 allée des Pins, Versailles', meteo: '🌤️' },
      { id: 3, nom: 'Réfection toiture Leroy', client: 'M. Leroy', tel: '06 33 44 55 66', corps: 'Couverture', statut: 'termine', avancement: 100, budget: 22000, depenses: 21340, debut: '2026-01-15', fin: '2026-03-01', equipe: ['Pierre', 'Nicolas'], priorite: 'basse', note: 'PV signé ✓', adresse: '5 rue du Moulin, Lyon 3e', meteo: '✅' },
      { id: 4, nom: 'Aménagement cuisine Brun', client: 'Famille Brun', tel: '06 44 55 66 77', corps: 'Électricité + Plomberie', statut: 'en_attente', avancement: 0, budget: 18500, depenses: 0, debut: '2026-06-01', fin: '2026-07-15', equipe: [], priorite: 'normale', note: '', adresse: '3 rue Nationale, Bordeaux', meteo: '📋' },
      { id: 5, nom: 'Ravalement façade Moreau', client: 'Synd. Copropriété', tel: '06 55 66 77 88', corps: 'Façade + Peinture', statut: 'en_cours', avancement: 52, budget: 56000, depenses: 30200, debut: '2026-02-20', fin: '2026-05-31', equipe: ['Thomas', 'Kevin'], priorite: 'haute', note: 'Réunion copro 25/05', adresse: '22 bd Haussmann, Paris 9e', meteo: '🌤️' },
    ],
    taches: [
      { id: 1, chantierId: 1, titre: 'Coulage dalle béton', responsable: 'Ali', debut: '2026-05-01', fin: '2026-05-08', statut: 'fait', duree: 7, priorite: 'haute' },
      { id: 2, chantierId: 1, titre: 'Installation plomberie sdb', responsable: 'Marc', debut: '2026-05-09', fin: '2026-05-18', statut: 'en_cours', duree: 9, priorite: 'haute' },
      { id: 3, chantierId: 1, titre: 'Carrelage sol RDC', responsable: 'Ali', debut: '2026-05-15', fin: '2026-05-25', statut: 'a_faire', duree: 10, priorite: 'normale' },
      { id: 4, chantierId: 1, titre: 'Peinture intérieure', responsable: 'Marc', debut: '2026-05-20', fin: '2026-06-05', statut: 'a_faire', duree: 16, priorite: 'basse' },
      { id: 5, chantierId: 2, titre: 'Fondations extension', responsable: 'Karim', debut: '2026-04-10', fin: '2026-04-20', statut: 'fait', duree: 10, priorite: 'haute' },
      { id: 6, chantierId: 2, titre: 'Élévation murs', responsable: 'Sébastien', debut: '2026-04-21', fin: '2026-05-10', statut: 'en_cours', duree: 19, priorite: 'haute' },
      { id: 7, chantierId: 5, titre: 'Préparation supports', responsable: 'Thomas', debut: '2026-02-20', fin: '2026-03-05', statut: 'fait', duree: 13, priorite: 'normale' },
      { id: 8, chantierId: 5, titre: 'Peinture finition', responsable: 'Kevin', debut: '2026-05-01', fin: '2026-05-31', statut: 'en_cours', duree: 30, priorite: 'normale' },
    ],
    factures: [
      { id: 'FAC-001', chantierId: 1, chantier: 'Villa Dupont', client: 'M. Dupont', montant: 28500, statut: 'payee', date: '2026-03-15', echeance: '2026-04-15' },
      { id: 'FAC-002', chantierId: 2, chantier: 'Extension Martin', client: 'Mme Martin', montant: 40000, statut: 'payee', date: '2026-04-01', echeance: '2026-05-01' },
      { id: 'FAC-003', chantierId: 5, chantier: 'Ravalement Moreau', client: 'Synd. Copropriété', montant: 18000, statut: 'en_attente', date: '2026-04-20', echeance: '2026-05-20' },
      { id: 'FAC-004', chantierId: 1, chantier: 'Villa Dupont', client: 'M. Dupont', montant: 22000, statut: 'en_retard', date: '2026-04-10', echeance: '2026-05-10' },
      { id: 'FAC-005', chantierId: 3, chantier: 'Toiture Leroy', client: 'M. Leroy', montant: 21340, statut: 'payee', date: '2026-03-05', echeance: '2026-04-05' },
    ],
    equipe: [
      { id: 1, nom: 'Jean Dupont', role: 'Chef de chantier', tel: '06 12 34 56 78', heures: 142, chantiers: [1, 2], dispo: true },
      { id: 2, nom: 'Marc Lefebvre', role: 'Chef de chantier', tel: '06 23 45 67 89', heures: 98, chantiers: [1, 5], dispo: true },
      { id: 3, nom: 'Ali Benali', role: 'Maçon', tel: '06 34 56 78 90', heures: 126, chantiers: [1], dispo: false },
      { id: 4, nom: 'Karim Diallo', role: 'Gros Œuvre', tel: '06 45 67 89 01', heures: 110, chantiers: [2], dispo: true },
      { id: 5, nom: 'Thomas Bernard', role: 'Façadier', tel: '06 67 89 01 23', heures: 136, chantiers: [5], dispo: true },
      { id: 6, nom: 'Kevin Simon', role: 'Peintre', tel: '06 89 01 23 45', heures: 92, chantiers: [5], dispo: true },
    ],
    rapports: [
      { id: 1, chantierId: 1, date: '2026-05-16', auteur: 'Marc Lefebvre', meteo: '☀️', temperature: '22°C', avancement: 'Coulage dalle terminé. Plomberie en cours section nord.', problemes: 'RAS', presences: ['Marc', 'Ali'], photos: 3 },
      { id: 2, chantierId: 5, date: '2026-05-16', auteur: 'Thomas Bernard', meteo: '🌤️', temperature: '18°C', avancement: 'Peinture finition 60% zone nord.', problemes: 'Manque 2 bidons blanc cassé', presences: ['Thomas', 'Kevin'], photos: 5 },
    ],
    messages: [
      { id: 1, chantierId: 1, auteur: 'Marc Lefebvre', role: 'chef', texte: 'Dalle coulée ce matin, RAS. On attaque la plomberie demain.', heure: '08:32', date: '2026-05-16' },
      { id: 2, chantierId: 1, auteur: 'Ali Benali', role: 'employe', texte: "OK chef. J'ai pris les photos.", heure: '08:45', date: '2026-05-16' },
      { id: 3, chantierId: 1, auteur: 'Jean Dupont', role: 'admin', texte: 'Parfait. M. Dupont a demandé une visite vendredi matin.', heure: '09:10', date: '2026-05-16' },
      { id: 4, chantierId: 5, auteur: 'Thomas Bernard', role: 'chef', texte: "Il manque 2 bidons de blanc cassé. Quelqu'un peut passer chez Point P ?", heure: '14:20', date: '2026-05-16' },
      { id: 5, chantierId: 5, auteur: 'Jean Dupont', role: 'admin', texte: 'Je commande en ligne, livraison demain matin.', heure: '14:35', date: '2026-05-16' },
    ],
    avenants: [
      { id: 1, chantierId: 1, titre: "Ajout douche à l'italienne", description: "Remplacement baignoire par douche à l'italienne.", montant: 2800, statut: 'accepte', dateCreation: '2026-04-20', dateValidation: '2026-04-22', validePar: 'M. Dupont' },
      { id: 2, chantierId: 1, titre: 'Peinture couloir en plus', description: "Peinture couloir d'entrée non prévu initialement.", montant: 650, statut: 'en_attente', dateCreation: '2026-05-10', dateValidation: '', validePar: '' },
    ],
    heures: [
      { id: 1, membreId: 3, membreNom: 'Ali Benali', chantierId: 1, date: '2026-05-19', arrivee: '07:30', depart: '17:00', pauseMin: 45, description: 'Préparation coffrage dalle RDC', valide: true, valideePar: 'Marc Lefebvre' },
      { id: 2, membreId: 2, membreNom: 'Marc Lefebvre', chantierId: 1, date: '2026-05-19', arrivee: '07:00', depart: '17:30', pauseMin: 60, description: 'Supervision coffrage + réunion client', valide: true, valideePar: 'Jean Dupont' },
      { id: 3, membreId: 5, membreNom: 'Thomas Bernard', chantierId: 5, date: '2026-05-19', arrivee: '08:00', depart: '16:00', pauseMin: 45, description: 'Peinture façade zone nord — 1ère couche', valide: true, valideePar: 'Marc Lefebvre' },
      { id: 4, membreId: 6, membreNom: 'Kevin Simon', chantierId: 5, date: '2026-05-19', arrivee: '08:30', depart: '16:30', pauseMin: 45, description: 'Préparation enduit façade est', valide: true, valideePar: 'Marc Lefebvre' },
      { id: 5, membreId: 3, membreNom: 'Ali Benali', chantierId: 1, date: '2026-05-20', arrivee: '07:30', depart: '17:00', pauseMin: 45, description: 'Coulage dalle béton RDC', valide: true, valideePar: 'Marc Lefebvre' },
      { id: 6, membreId: 2, membreNom: 'Marc Lefebvre', chantierId: 1, date: '2026-05-20', arrivee: '07:00', depart: '18:00', pauseMin: 60, description: 'Contrôle coulage + coordination plomberie', valide: true, valideePar: 'Jean Dupont' },
      { id: 7, membreId: 5, membreNom: 'Thomas Bernard', chantierId: 5, date: '2026-05-20', arrivee: '08:00', depart: '16:00', pauseMin: 45, description: 'Peinture façade zone nord — 2ème couche', valide: true, valideePar: 'Marc Lefebvre' },
      { id: 8, membreId: 4, membreNom: 'Karim Diallo', chantierId: 2, date: '2026-05-20', arrivee: '07:00', depart: '16:00', pauseMin: 45, description: 'Élévation murs parpaings R+1', valide: true, valideePar: 'Jean Dupont' },
      { id: 9, membreId: 3, membreNom: 'Ali Benali', chantierId: 1, date: '2026-05-21', arrivee: '07:30', depart: '12:00', pauseMin: 0, description: 'Décoffrage dalle — demi-journée', valide: true, valideePar: 'Marc Lefebvre' },
      { id: 10, membreId: 2, membreNom: 'Marc Lefebvre', chantierId: 1, date: '2026-05-21', arrivee: '07:00', depart: '17:00', pauseMin: 60, description: 'Installation plomberie SDB — secteur nord', valide: true, valideePar: 'Jean Dupont' },
      { id: 11, membreId: 4, membreNom: 'Karim Diallo', chantierId: 2, date: '2026-05-21', arrivee: '07:00', depart: '16:00', pauseMin: 45, description: 'Élévation murs + chaînage horizontal', valide: true, valideePar: 'Jean Dupont' },
      { id: 12, membreId: 6, membreNom: 'Kevin Simon', chantierId: 5, date: '2026-05-21', arrivee: '08:00', depart: '16:30', pauseMin: 45, description: 'Peinture façade est — finition', valide: false, valideePar: '' },
      { id: 13, membreId: 3, membreNom: 'Ali Benali', chantierId: 1, date: '2026-05-22', arrivee: '07:30', depart: '17:00', pauseMin: 45, description: 'Pose carrelage sol RDC — début', valide: false, valideePar: '' },
      { id: 14, membreId: 2, membreNom: 'Marc Lefebvre', chantierId: 1, date: '2026-05-22', arrivee: '07:00', depart: '17:00', pauseMin: 60, description: 'Plomberie SDB — raccordements', valide: false, valideePar: '' },
      { id: 15, membreId: 5, membreNom: 'Thomas Bernard', chantierId: 5, date: '2026-05-22', arrivee: '08:00', depart: '17:00', pauseMin: 45, description: 'Ravalement façade sud — début', valide: false, valideePar: '' },
      { id: 16, membreId: 4, membreNom: 'Karim Diallo', chantierId: 2, date: '2026-05-22', arrivee: '07:00', depart: '15:30', pauseMin: 45, description: 'Pose linteaux fenêtres R+1', valide: false, valideePar: '' },
      { id: 17, membreId: 3, membreNom: 'Ali Benali', chantierId: 1, date: '2026-05-23', arrivee: '07:30', depart: '16:00', pauseMin: 45, description: 'Carrelage RDC — avancement 60%', valide: false, valideePar: '' },
      { id: 18, membreId: 2, membreNom: 'Marc Lefebvre', chantierId: 1, date: '2026-05-23', arrivee: '07:00', depart: '16:30', pauseMin: 60, description: 'Plomberie SDB terminée + rapport hebdo', valide: false, valideePar: '' },
      { id: 19, membreId: 5, membreNom: 'Thomas Bernard', chantierId: 5, date: '2026-05-23', arrivee: '08:00', depart: '16:00', pauseMin: 45, description: 'Ravalement façade sud — finition', valide: false, valideePar: '' },
      { id: 20, membreId: 6, membreNom: 'Kevin Simon', chantierId: 5, date: '2026-05-23', arrivee: '08:30', depart: '15:00', pauseMin: 30, description: 'Retouches peinture + nettoyage chantier', valide: false, valideePar: '' },
      { id: 21, membreId: 3, membreNom: 'Ali Benali', chantierId: 1, date: '2026-05-24', arrivee: '07:30', depart: '12:00', pauseMin: 0, description: 'Rattrapage carrelage — finition RDC', valide: false, valideePar: '' },
      { id: 22, membreId: 2, membreNom: 'Marc Lefebvre', chantierId: 1, date: '2026-05-24', arrivee: '07:00', depart: '12:30', pauseMin: 0, description: 'Visite client + PV avancement', valide: false, valideePar: '' },
    ],
    punchlist: [
      { id: 1, chantierId: 1, titre: 'Fissure angle mur cuisine', description: 'Fissure verticale 15cm angle mur/plafond.', categorie: 'Maçonnerie', priorite: 'haute', statut: 'en_cours', signalePar: 'Marc Lefebvre', dateSignalement: '2026-05-10', dateResolution: '', assigneA: 'Ali Benali', photos: 1 },
      { id: 2, chantierId: 1, titre: 'Carrelage décollé salle de bain', description: '3 carreaux décollés dans la douche.', categorie: 'Carrelage', priorite: 'haute', statut: 'ouvert', signalePar: 'M. Dupont', dateSignalement: '2026-05-14', dateResolution: '', assigneA: 'Ali Benali', photos: 2 },
      { id: 3, chantierId: 1, titre: 'Joint silicone baignoire', description: 'Joint non conforme, discontinuités.', categorie: 'Plomberie', priorite: 'normale', statut: 'resolu', signalePar: 'Marc Lefebvre', dateSignalement: '2026-05-08', dateResolution: '2026-05-12', assigneA: 'Marc Lefebvre', photos: 0 },
    ],
  }
}
