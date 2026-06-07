/**
 * Crée les comptes de démo dans Supabase Auth (+ profils via trigger).
 *
 * Prérequis :
 * - .env ou .env.local avec VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 *   (Supabase → Project Settings → API → service_role)
 * - Email/Password activé, "Confirm email" désactivé en dev
 * - supabase/schema.sql exécuté dans le SQL Editor
 *
 * Usage : npm run seed:users
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile(name) {
  const path = resolve(root, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m || line.trimStart().startsWith('#')) continue
    const val = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}

loadEnvFile('.env')
loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ Définissez VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env ou .env.local')
  console.error('   Clé service_role : Supabase Dashboard → Project Settings → API')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Aligné sur COMPTES dans App.jsx */
const DEMO_USERS = [
  { email: 'admin@buildeasy.eu', password: 'admin123', nom: 'Jean Dupont', role: 'admin', ch_ids: [], vierge: false },
  { email: 'chef@buildeasy.eu', password: 'chef123', nom: 'Marc Lefebvre', role: 'chef', ch_ids: [1, 5], vierge: false },
  { email: 'ali@buildeasy.eu', password: 'employe123', nom: 'Ali Benali', role: 'employe', ch_ids: [1], vierge: false },
  { email: 'client@buildeasy.eu', password: 'client123', nom: 'M. Dupont', role: 'client', ch_ids: [1], vierge: false },
  { email: 'demo1@buildeasy.eu', password: 'buildeasy', nom: 'Gérant Demo 1', role: 'admin', ch_ids: [], vierge: true },
  { email: 'demo2@buildeasy.eu', password: 'buildeasy', nom: 'Gérant Demo 2', role: 'admin', ch_ids: [], vierge: true },
  { email: 'demo3@buildeasy.eu', password: 'buildeasy', nom: 'Gérant Demo 3', role: 'admin', ch_ids: [], vierge: true },
]

async function upsertUser(u) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existing = list?.users?.find((x) => x.email?.toLowerCase() === u.email.toLowerCase())

  let userId = existing?.id

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
      user_metadata: { nom: u.nom, role: u.role, vierge: u.vierge },
    })
    if (error) throw error
    console.log(`↻ Mis à jour : ${u.email}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { nom: u.nom, role: u.role, vierge: u.vierge },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`✓ Créé : ${u.email}`)
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: userId,
      nom: u.nom,
      role: u.role,
      email: u.email,
      ch_ids: u.ch_ids,
      vierge: u.vierge,
    },
    { onConflict: 'id' }
  )

  if (profileError && !profileError.message.includes('violates foreign key')) {
    throw profileError
  }
}

console.log('🏗 BuildEasy — seed comptes démo\n')

for (const u of DEMO_USERS) {
  try {
    await upsertUser(u)
  } catch (e) {
    console.error(`✗ ${u.email}:`, e.message)
  }
}

console.log('\n✅ Terminé. Reconnectez-vous dans l’app (ex. demo1@buildeasy.eu / buildeasy).')
