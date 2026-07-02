#!/usr/bin/env node
/**
 * Termine le setup après stripe:complete (Stripe déjà OK).
 * Prérequis : npx supabase login  +  vercel login
 *   npm run stripe:finish
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'

function loadEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const local = loadEnv(resolve(root, '.stripe-setup.local.env'))
const setup = existsSync(resolve(root, '.stripe-setup.env'))
  ? loadEnv(resolve(root, '.stripe-setup.env'))
  : {}

const stripeKey = local.STRIPE_SECRET_KEY
const publishable = local.STRIPE_PUBLISHABLE_KEY || setup.VITE_STRIPE_PUBLISHABLE_KEY
const webhookSecret = setup.STRIPE_WEBHOOK_SECRET
const prices = {
  starter: setup.VITE_STRIPE_PRICE_STARTER,
  pro: setup.VITE_STRIPE_PRICE_PRO,
  entreprise: setup.VITE_STRIPE_PRICE_ENTREPRISE,
}

if (!stripeKey?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY manquante (.stripe-setup.local.env)')
if (!webhookSecret?.startsWith('whsec_')) throw new Error('STRIPE_WEBHOOK_SECRET manquant (.stripe-setup.env)')
if (!prices.pro) throw new Error('Price IDs manquants (.stripe-setup.env) — relancez stripe:complete')

console.log('→ Secrets Supabase…')
const secretArgs = [
  'supabase', 'secrets', 'set', '--project-ref', PROJECT_REF,
  `STRIPE_SECRET_KEY=${stripeKey}`,
  `STRIPE_WEBHOOK_SECRET=${webhookSecret}`,
  `STRIPE_PRICE_STARTER=${prices.starter}`,
  `STRIPE_PRICE_PRO=${prices.pro}`,
  `STRIPE_PRICE_ENTREPRISE=${prices.entreprise}`,
]
const sb = spawnSync('npx', secretArgs, { stdio: 'inherit', cwd: root })
if (sb.status !== 0) {
  console.error('\n❌ Échec Supabase — lancez : npx supabase login')
  process.exit(1)
}
console.log('  ✓ Secrets Supabase OK')

function vercelEnv(key, val, target) {
  let r = spawnSync('vercel', ['env', 'add', key, target, '--force'], { input: val, cwd: root, encoding: 'utf8' })
  if (r.status !== 0) {
    r = spawnSync('vercel', ['env', 'add', key, target], { input: val, cwd: root, encoding: 'utf8' })
  }
  if (r.status !== 0) throw new Error(`vercel env ${key} ${target}: ${r.stderr || r.stdout}`)
}

console.log('\n→ Variables Vercel…')
const vercelVars = {
  VITE_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
  VITE_STRIPE_PUBLISHABLE_KEY: publishable,
  VITE_STRIPE_PRICE_STARTER: prices.starter,
  VITE_STRIPE_PRICE_PRO: prices.pro,
  VITE_STRIPE_PRICE_ENTREPRISE: prices.entreprise,
  VITE_DEMO_MODE: 'false',
}
// Charger clé Supabase depuis .env.local si disponible
try {
  const envLocal = loadEnv(resolve(root, '.env.local'))
  if (envLocal.VITE_SUPABASE_ANON_KEY) vercelVars.VITE_SUPABASE_ANON_KEY = envLocal.VITE_SUPABASE_ANON_KEY
  else if (envLocal.VITE_SUPABASE_URL) vercelVars.VITE_SUPABASE_URL = envLocal.VITE_SUPABASE_URL
} catch { /* ignore */ }
if (!vercelVars.VITE_SUPABASE_ANON_KEY) {
  const envFile = loadEnv(resolve(root, '.env'))
  vercelVars.VITE_SUPABASE_ANON_KEY = envFile.VITE_SUPABASE_ANON_KEY || envFile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
}
if (!vercelVars.VITE_SUPABASE_ANON_KEY) throw new Error('VITE_SUPABASE_ANON_KEY manquante — ajoutez-la dans .env.local')
for (const [key, val] of Object.entries(vercelVars)) {
  for (const target of ['production', 'preview', 'development']) {
    vercelEnv(key, val, target)
  }
  console.log(`  ✓ ${key}`)
}

console.log('\n→ Déploiement Vercel…')
execSync('vercel --prod --yes', { stdio: 'inherit', cwd: root })
console.log('\n✅ Setup terminé ! Test : https://buildeasy.vercel.app/app')
