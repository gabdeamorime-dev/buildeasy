/**
 * Comptes démo — exclus du bundle production sauf si VITE_DEMO_MODE=true ou dev local.
 * Ne jamais activer en prod : mots de passe visibles côté client.
 */
const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV

export function isDemoModeEnabled() {
  return DEMO_ENABLED
}

/** @type {Array<{id:number,nom:string,role:string,email:string,mdp:string,chIds:number[],vierge:boolean}>} */
export const DEMO_COMPTES = DEMO_ENABLED
  ? [
      { id: 1, nom: 'Jean Dupont', role: 'admin', email: 'admin@buildeasy.eu', mdp: 'admin123', chIds: [], vierge: false },
      { id: 2, nom: 'Marc Lefebvre', role: 'chef', email: 'chef@buildeasy.eu', mdp: 'chef123', chIds: [1, 5], vierge: false },
      { id: 3, nom: 'Ali Benali', role: 'employe', email: 'ali@buildeasy.eu', mdp: 'employe123', chIds: [1], vierge: false },
      { id: 4, nom: 'M. Dupont', role: 'client', email: 'client@buildeasy.eu', mdp: 'client123', chIds: [1], vierge: false },
      { id: 10, nom: 'Gérant Demo 1', role: 'admin', email: 'demo1@buildeasy.eu', mdp: 'buildeasy', chIds: [], vierge: true },
      { id: 11, nom: 'Gérant Demo 2', role: 'admin', email: 'demo2@buildeasy.eu', mdp: 'buildeasy', chIds: [], vierge: true },
      { id: 12, nom: 'Gérant Demo 3', role: 'admin', email: 'demo3@buildeasy.eu', mdp: 'buildeasy', chIds: [], vierge: true },
    ]
  : []
