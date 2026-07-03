/**
 * Comptes démo — connexion locale (DEV / VITE_DEMO_MODE) ou cartes sur l'écran auth (VITE_SHOW_DEMO_ACCOUNTS).
 */
const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV

/** Cartes démo sur login / inscription (prospects). */
export function isDemoAuthVisible() {
  return DEMO_ENABLED || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true'
}

export function isDemoModeEnabled() {
  return DEMO_ENABLED
}

/** @type {Array<{id:number,nom:string,role:string,email:string,mdp:string,chIds:number[],vierge:boolean}>} */
const AUTH_DEMO_ACCOUNTS = [
  { id: 1, nom: 'Jean Dupont', role: 'admin', email: 'admin@buildeasy.eu', mdp: 'admin123', chIds: [], vierge: false },
  { id: 2, nom: 'Marc Lefebvre', role: 'chef', email: 'chef@buildeasy.eu', mdp: 'chef123', chIds: [1, 5], vierge: false },
  { id: 3, nom: 'Ali Benali', role: 'employe', email: 'ali@buildeasy.eu', mdp: 'employe123', chIds: [1], vierge: false },
  { id: 4, nom: 'M. Dupont', role: 'client', email: 'client@buildeasy.eu', mdp: 'client123', chIds: [1], vierge: false },
  { id: 10, nom: 'Gérant Demo 1', role: 'admin', email: 'demo1@buildeasy.eu', mdp: 'buildeasy', chIds: [], vierge: true },
  { id: 11, nom: 'Gérant Demo 2', role: 'admin', email: 'demo2@buildeasy.eu', mdp: 'buildeasy', chIds: [], vierge: true },
  { id: 12, nom: 'Gérant Demo 3', role: 'admin', email: 'demo3@buildeasy.eu', mdp: 'buildeasy', chIds: [], vierge: true },
]

export const DEMO_COMPTES = DEMO_ENABLED ? AUTH_DEMO_ACCOUNTS : []

/** Comptes affichés sur login / inscription (cloud ou local). */
export function getAuthDemoAccounts() {
  return isDemoAuthVisible() ? AUTH_DEMO_ACCOUNTS : []
}
