/**
 * Crée un compte client gérant BTP + org + essai gratuit.
 *
 * Usage:
 *   node scripts/create-client.mjs --slug vesty --nom "Vesty" --entreprise "Vesty BTP" --trial 15
 *   node scripts/create-client.mjs --email contact@example.com --password "MonMdp123!" --nom "Jean" --entreprise "ACME BTP"
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

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

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const slug = (arg('slug', 'vesty') || 'vesty').toLowerCase().replace(/[^a-z0-9-]/g, '')
const nom = arg('nom', slug.charAt(0).toUpperCase() + slug.slice(1))
const entreprise = arg('entreprise', `${nom} BTP`)
const email = arg('email', `${slug}@buildeasy.eu`).trim().toLowerCase()
const password = arg('password', `Build${slug.charAt(0).toUpperCase()}${slug.slice(1)}2026!`)
const trialDays = Math.max(1, parseInt(arg('trial', '15'), 10) || 15)
const planId = arg('plan', 'starter')

const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('❌ VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(targetEmail) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  return list?.users?.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase()) || null
}

async function ensureReferralCode(orgId) {
  const code = slug.toUpperCase().slice(0, 8) + randomBytes(2).toString('hex').toUpperCase().slice(0, 4)
  const { error } = await admin.from('referral_codes').upsert(
    { org_id: orgId, code, uses_count: 0 },
    { onConflict: 'org_id' },
  )
  if (error && !error.message.includes('does not exist')) {
    console.warn('⚠ referral_codes:', error.message)
  } else if (!error) {
    console.log(`   Code parrainage : ${code}`)
  }
}

async function main() {
  console.log(`\n🏗 BuildEasy — création client « ${nom} »\n`)

  let userId
  const existing = await findUserByEmail(email)

  if (existing) {
    userId = existing.id
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { nom, entreprise, signup: 'true', role: 'admin', vierge: true },
    })
    if (error) throw error
    console.log(`↻ Compte auth mis à jour : ${email}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom, entreprise, signup: 'true', role: 'admin', vierge: true },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`✓ Compte auth créé : ${email}`)
  }

  const { data: profile } = await admin.from('profiles').select('id, org_id').eq('id', userId).maybeSingle()

  let orgId = profile?.org_id

  if (!orgId) {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({ name: entreprise, plan_id: planId })
      .select('id')
      .single()
    if (orgErr) throw orgErr
    orgId = org.id
    console.log(`✓ Organisation créée : ${entreprise}`)
  }

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + trialDays)

  const { error: profileErr } = await admin.from('profiles').upsert({
    id: userId,
    nom,
    email,
    role: 'admin',
    org_id: orgId,
    plan_id: planId,
    vierge: true,
    ch_ids: [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (profileErr) throw profileErr
  console.log('✓ Profil gérant configuré')

  const { error: billErr } = await admin.from('billing_subscriptions').upsert({
    org_id: orgId,
    plan_id: planId,
    status: 'trialing',
    current_period_end: trialEnd.toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id' })
  if (billErr) throw billErr
  console.log(`✓ Essai ${trialDays} jours (jusqu'au ${trialEnd.toLocaleDateString('fr-FR')})`)

  await ensureReferralCode(orgId)

  console.log('\n────────────────────────────────────')
  console.log('  Client prêt — identifiants :')
  console.log(`  Email      : ${email}`)
  console.log(`  Mot de passe : ${password}`)
  console.log(`  Rôle       : Gérant (admin)`)
  console.log(`  Plan       : ${planId} · essai ${trialDays} jours`)
  console.log(`  Connexion  : https://buildeasy.vercel.app/app`)
  console.log('────────────────────────────────────\n')
}

main().catch((e) => {
  console.error('❌', e.message || e)
  process.exit(1)
})
