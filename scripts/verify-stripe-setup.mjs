#!/usr/bin/env node
/**
 * Vérifie la config Stripe BuildEasy — lancer : npm run stripe:verify
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'
const BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`

function ok(msg) { console.log('✅', msg) }
function fail(msg) { console.log('❌', msg) }
function warn(msg) { console.log('⚠️ ', msg) }

function loadLocal() {
  const p = resolve(root, '.stripe-setup.local.env')
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1)
  }
  return out
}

async function check(name, url, expectStatus) {
  try {
    const r = await fetch(url, { method: 'GET' })
    if (expectStatus.includes(r.status)) {
      ok(`${name} → HTTP ${r.status}`)
      return true
    }
    fail(`${name} → HTTP ${r.status} (attendu ${expectStatus.join('/')})`)
    return false
  } catch (e) {
    fail(`${name} → ${e.message}`)
    return false
  }
}

console.log('\n=== BuildEasy Stripe — vérification ===\n')

const local = loadLocal()
if (local.STRIPE_SECRET_KEY?.startsWith('sk_')) ok('Clés locales (.stripe-setup.local.env)')
else fail('Clés locales manquantes')

if (existsSync(resolve(root, '.stripe-setup.env'))) ok('.stripe-setup.env (produits créés)')
else warn('.stripe-setup.env absent — relancez npm run stripe:complete')

const whoami = spawnSync('vercel', ['whoami'], { encoding: 'utf8', cwd: root })
if (whoami.status === 0) ok(`Vercel connecté : ${whoami.stdout.trim()}`)
else fail('Vercel non connecté (vercel login)')

const envLs = spawnSync('vercel', ['env', 'ls'], { encoding: 'utf8', cwd: root })
const envOut = envLs.stdout || ''
for (const k of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_STRIPE_PRICE_PRO',
  'VITE_DEMO_MODE',
]) {
  if (envOut.includes(k)) ok(`Vercel env : ${k}`)
  else warn(`Vercel env manquant : ${k}`)
}

if (local.STRIPE_SECRET_KEY) {
  try {
    const r = await fetch('https://api.stripe.com/v1/products?limit=5&active=true', {
      headers: { Authorization: `Bearer ${local.STRIPE_SECRET_KEY}` },
    })
    const j = await r.json()
    const be = (j.data || []).filter((p) => p.metadata?.buildeasy_plan || p.name?.includes('BuildEasy'))
    if (be.length >= 3) ok(`Stripe : ${be.length} produits BuildEasy`)
    else warn(`Stripe : ${be.length} produit(s) BuildEasy (attendu 3)`)

    const wh = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=20', {
      headers: { Authorization: `Bearer ${local.STRIPE_SECRET_KEY}` },
    })
    const whj = await wh.json()
    const hook = (whj.data || []).find((e) => e.url?.includes('stripe-webhook'))
    if (hook) ok(`Webhook Stripe : ${hook.url}`)
    else fail('Webhook Stripe non configuré')
  } catch (e) {
    fail(`API Stripe : ${e.message}`)
  }
}

await check('stripe-checkout (sans auth)', `${BASE}/stripe-checkout?plan=pro`, [401, 503])
await check('stripe-portal (sans auth)', `${BASE}/stripe-portal`, [401, 503])
await check('stripe-webhook (sans signature)', `${BASE}/stripe-webhook`, [400, 503])

try {
  const r = await fetch('https://buildeasy.vercel.app/', { method: 'HEAD' })
  if (r.status === 200) ok(`Production buildeasy.vercel.app → ${r.status}`)
  else warn(`Production buildeasy.vercel.app → HTTP ${r.status}`)
} catch (e) {
  warn(`Production : ${e.message}`)
}

console.log('\n=== Fin ===\n')
