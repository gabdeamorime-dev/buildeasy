/**
 * Crée les 4 comptes de démo dans Supabase Auth + leurs profils.
 *
 * Prérequis :
 * - .env avec VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (Settings → API → service_role)
 * - Email/Password activé, "Confirm email" désactivé en dev
 * - supabase/auth.sql exécuté
 *
 * Usage : node scripts/seed-demo-users.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const path = resolve(root, '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ Définissez VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_USERS = [
  { email: 'admin@buildeasy.eu', password: 'admin123', nom: 'Jean Dupont', role: 'admin', chantier_ids: [] },
  { email: 'chef@buildeasy.eu', password: 'chef123', nom: 'Marc Lefebvre', role: 'chef', chantier_ids: [1, 5] },
  { email: 'ali@buildeasy.eu', password: 'employe123', nom: 'Ali Benali', role: 'employe', chantier_ids: [1] },
  { email: 'client@buildeasy.eu', password: 'client123', nom: 'M. Dupont Client', role: 'client', chantier_ids: [1] },
]

async function upsertUser(u) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find((x) => x.email === u.email)

  let userId = existing?.id

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
      user_metadata: { nom: u.nom },
      app_metadata: { role: u.role, chantier_ids: u.chantier_ids },
    })
    console.log(`↻ Mis à jour : ${u.email}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { nom: u.nom },
      app_metadata: { role: u.role, chantier_ids: u.chantier_ids },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`✓ Créé : ${u.email}`)
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    nom: u.nom,
    role: u.role,
    chantier_ids: u.chantier_ids,
    updated_at: new Date().toISOString(),
  })

  if (profileError) throw profileError
}

console.log('🏗 BuildEasy — seed comptes démo\n')

for (const u of DEMO_USERS) {
  try {
    await upsertUser(u)
  } catch (e) {
    console.error(`✗ ${u.email}:`, e.message)
  }
}

console.log('\n✅ Terminé. Connectez-vous avec les comptes de démo dans l’app.')
