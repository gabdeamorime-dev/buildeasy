#!/usr/bin/env node
/**
 * Setup Stripe complet pour BuildEasy — à lancer dans VOTRE terminal :
 *   cd ~/buildeasy && node scripts/complete-stripe-setup.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localEnv = resolve(root, '.stripe-setup.local.env')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`

function loadEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const env = loadEnv(localEnv)
if (!existsSync(localEnv)) throw new Error('.stripe-setup.local.env introuvable')
const stripeKey = env.STRIPE_SECRET_KEY
const publishable = env.STRIPE_PUBLISHABLE_KEY
if (!stripeKey?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY manquante dans .stripe-setup.local.env')
if (!publishable?.startsWith('pk_')) throw new Error('STRIPE_PUBLISHABLE_KEY manquante dans .stripe-setup.local.env')

const PLANS = [
  { id: 'starter', name: 'BuildEasy Starter', amount: 8000, desc: 'Artisans et petites équipes' },
  { id: 'pro', name: 'BuildEasy Pro', amount: 14900, desc: 'PME — tout centraliser' },
  { id: 'entreprise', name: 'BuildEasy Entreprise', amount: 24900, desc: 'Entreprises en croissance' },
]

const headers = { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }

async function stripePost(path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers, body: new URLSearchParams(params) })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j))
  return j
}

async function stripeGet(path, query = '') {
  const r = await fetch(`https://api.stripe.com/v1/${path}${query}`, { headers: { Authorization: `Bearer ${stripeKey}` } })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j))
  return j
}

console.log('→ Produits Stripe…')
const prices = {}
for (const plan of PLANS) {
  const existing = await stripeGet('products', '?limit=100&active=true')
  let product = existing.data?.find((p) => p.metadata?.buildeasy_plan === plan.id)
  if (!product) {
    product = await stripePost('products', { name: plan.name, description: plan.desc, 'metadata[buildeasy_plan]': plan.id })
    console.log(`  + Produit créé : ${plan.name}`)
  }
  const priceList = await stripeGet('prices', `?product=${product.id}&active=true&limit=10`)
  let price = priceList.data?.find((p) => p.unit_amount === plan.amount && p.recurring?.interval === 'month')
  if (!price) {
    price = await stripePost('prices', {
      product: product.id,
      unit_amount: String(plan.amount),
      currency: 'eur',
      'recurring[interval]': 'month',
      'metadata[buildeasy_plan]': plan.id,
    })
    console.log(`  + Prix créé : ${plan.amount / 100} €/mois`)
  }
  prices[plan.id] = price.id
  console.log(`  ✓ ${plan.id} → ${price.id}`)
}

console.log('\n→ Webhook Stripe…')
const setupPath = resolve(root, '.stripe-setup.env')
const setup = existsSync(setupPath) ? loadEnv(setupPath) : {}
const endpoints = await stripeGet('webhook_endpoints', '?limit=100')
const events = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]
let webhook = endpoints.data?.find((e) => e.url === WEBHOOK_URL)
if (!webhook) {
  const params = { url: WEBHOOK_URL, 'metadata[buildeasy]': 'true' }
  events.forEach((ev, i) => { params[`enabled_events[${i}]`] = ev })
  webhook = await stripePost('webhook_endpoints', params)
  console.log(`  + Webhook créé : ${WEBHOOK_URL}`)
} else {
  console.log(`  ✓ Webhook existant : ${webhook.id}`)
}

let webhookSecret = webhook.secret
if (!webhookSecret?.startsWith('whsec_')) {
  const fromFile = setup?.STRIPE_WEBHOOK_SECRET
  if (fromFile?.startsWith('whsec_')) {
    webhookSecret = fromFile
    console.log('  ✓ Secret depuis .stripe-setup.env')
  } else if (webhook.id) {
    console.log('  → Génération signing secret…')
    const rolled = await stripePost(`webhook_endpoints/${webhook.id}/secret`, {})
    webhookSecret = rolled.secret
    console.log('  + Nouveau signing secret généré')
  }
}
if (!webhookSecret?.startsWith('whsec_')) {
  throw new Error('Secret webhook introuvable — Dashboard Stripe → Webhooks → Signing secret → .stripe-setup.env')
}

writeFileSync(resolve(root, '.stripe-setup.env'), [
  `VITE_STRIPE_PUBLISHABLE_KEY=${publishable}`,
  `VITE_STRIPE_PRICE_STARTER=${prices.starter}`,
  `VITE_STRIPE_PRICE_PRO=${prices.pro}`,
  `VITE_STRIPE_PRICE_ENTREPRISE=${prices.entreprise}`,
  `STRIPE_WEBHOOK_SECRET=${webhookSecret}`,
].join('\n') + '\n')
console.log('  ✓ Price IDs sauvegardés (.stripe-setup.env)')

console.log('\n→ Secrets Supabase…')
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
  console.error('\n⚠️  Supabase : lancez `npx supabase login` puis `npm run stripe:finish`')
  process.exit(1)
}
console.log('  ✓ Secrets Supabase configurés')

function vercelEnv(key, val, target) {
  let r = spawnSync('vercel', ['env', 'add', key, target, '--force'], { input: val, cwd: root, encoding: 'utf8' })
  if (r.status !== 0) {
    r = spawnSync('vercel', ['env', 'add', key, target], { input: val, cwd: root, encoding: 'utf8' })
  }
  if (r.status !== 0) throw new Error(`vercel env add ${key} ${target}: ${r.stderr || r.stdout}`)
}

console.log('\n→ Variables Vercel…')
const vercelVars = {
  VITE_STRIPE_PUBLISHABLE_KEY: publishable,
  VITE_STRIPE_PRICE_STARTER: prices.starter,
  VITE_STRIPE_PRICE_PRO: prices.pro,
  VITE_STRIPE_PRICE_ENTREPRISE: prices.entreprise,
  VITE_DEMO_MODE: 'false',
}
for (const [key, val] of Object.entries(vercelVars)) {
  for (const target of ['production', 'preview', 'development']) {
    vercelEnv(key, val, target)
  }
  console.log(`  ✓ ${key}`)
}

console.log('\n→ Déploiement Vercel production…')
execSync('vercel --prod --yes', { stdio: 'inherit', cwd: root })

console.log('\n✅ Setup Stripe terminé !')
console.log('   Test : https://buildeasy.vercel.app/app → Plus → Mon abonnement → S\'abonner via Stripe')
console.log('   Carte test : 4242 4242 4242 4242')
