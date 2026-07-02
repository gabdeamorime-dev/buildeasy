#!/usr/bin/env node
/**
 * Configuration production : Stripe webhook + Supabase secrets + Vercel env + deploy.
 *
 * Usage:
 *   node scripts/configure-production.mjs
 *   node scripts/configure-production.mjs --deploy
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/stripe-webhook`
const VERCEL_PROJECT_ID = 'prj_OQEYJFsqiYuPQf9nBz56csbBKHy3'
const deploy = process.argv.includes('--deploy')

function loadEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

function merge(...sources) {
  return Object.assign({}, ...sources)
}

function requireOrExit(cond, msg) {
  if (!cond) {
    console.error(`❌ ${msg}`)
    process.exit(1)
  }
}

function getVercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  const authPath = resolve(homedir(), 'Library/Application Support/com.vercel.cli/auth.json')
  if (!existsSync(authPath)) return null
  try {
    return JSON.parse(readFileSync(authPath, 'utf8')).token
  } catch {
    return null
  }
}

async function vercelApi(path, { method = 'GET', body } = {}) {
  const token = getVercelToken()
  requireOrExit(token, 'Token Vercel introuvable → vercel login ou VERCEL_TOKEN')
  const r = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
  if (!r.ok) throw new Error(`Vercel API ${method} ${path} → ${r.status}: ${json.error?.message || text.slice(0, 200)}`)
  return json
}

async function upsertVercelEnv(key, value, targets) {
  const list = await vercelApi(`/v9/projects/${VERCEL_PROJECT_ID}/env`)
  const matches = (list.envs || []).filter((e) => e.key === key)

  if (matches.length > 0) {
    try {
      for (const found of matches) {
        // PATCH valeur seule — ne pas toucher au `type` (sensitive vs encrypted)
        await vercelApi(`/v9/projects/${VERCEL_PROJECT_ID}/env/${found.id}`, {
          method: 'PATCH',
          body: { value },
        })
      }
      return 'updated'
    } catch {
      console.log(`  ⚠ ${key} : suppression + recréation (conflit type Vercel)`)
      for (const found of matches) {
        await vercelApi(`/v9/projects/${VERCEL_PROJECT_ID}/env/${found.id}`, { method: 'DELETE' })
      }
    }
  }

  const prodPreview = targets.filter((t) => t !== 'development')
  const dev = targets.filter((t) => t === 'development')

  if (prodPreview.length) {
    await vercelApi(`/v10/projects/${VERCEL_PROJECT_ID}/env`, {
      method: 'POST',
      body: { key, value, target: prodPreview, type: 'sensitive' },
    })
  }
  if (dev.length) {
    await vercelApi(`/v10/projects/${VERCEL_PROJECT_ID}/env`, {
      method: 'POST',
      body: { key, value, target: dev, type: 'plain' },
    })
  }
  return matches.length ? 'recreated' : 'created'
}

async function stripeRequest(path, params, stripeKey) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j))
  return j
}

async function stripeGet(path, stripeKey) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j))
  return j
}

async function ensureStripeWebhook(stripeKey, existingSecret) {
  const endpoints = await stripeGet('webhook_endpoints?limit=100', stripeKey)
  let webhook = endpoints.data?.find((e) => e.url === WEBHOOK_URL)
  const events = [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
  ]

  if (!webhook) {
    const params = { url: WEBHOOK_URL, 'metadata[buildeasy]': 'true' }
    events.forEach((ev, i) => { params[`enabled_events[${i}]`] = ev })
    webhook = await stripeRequest('webhook_endpoints', params, stripeKey)
    console.log('  + Webhook Stripe créé')
    if (webhook.secret?.startsWith('whsec_')) return webhook.secret
  } else {
    console.log(`  ✓ Webhook Stripe existant (${webhook.id})`)
  }

  // Stripe ne renvoie le secret qu'à la création — pas au listage
  if (webhook.secret?.startsWith('whsec_')) return webhook.secret
  if (existingSecret?.startsWith('whsec_')) {
    console.log('  ✓ Secret depuis .stripe-setup.env')
    return existingSecret
  }

  // Générer un nouveau signing secret pour le webhook existant
  console.log('  → Génération d\'un nouveau signing secret…')
  const rolled = await stripeRequest(`webhook_endpoints/${webhook.id}/secret`, {}, stripeKey)
  if (rolled.secret?.startsWith('whsec_')) {
    console.log('  + Nouveau signing secret généré')
    return rolled.secret
  }

  throw new Error(
    'Secret webhook introuvable. Copiez whsec_… depuis Stripe Dashboard → Webhooks → ' + WEBHOOK_URL + ' → Signing secret, puis ajoutez STRIPE_WEBHOOK_SECRET=… dans .stripe-setup.env'
  )
}

function saveStripeSetupEnv({ publishable, prices, webhookSecret }) {
  const setupPath = resolve(root, '.stripe-setup.env')
  const prev = loadEnv(setupPath)
  writeFileSync(setupPath, [
    `# Généré/mis à jour par configure-production.mjs`,
    `VITE_STRIPE_PUBLISHABLE_KEY=${publishable || prev.VITE_STRIPE_PUBLISHABLE_KEY || ''}`,
    `VITE_STRIPE_PRICE_STARTER=${prices.starter || prev.VITE_STRIPE_PRICE_STARTER || ''}`,
    `VITE_STRIPE_PRICE_PRO=${prices.pro || prev.VITE_STRIPE_PRICE_PRO || ''}`,
    `VITE_STRIPE_PRICE_ENTREPRISE=${prices.entreprise || prev.VITE_STRIPE_PRICE_ENTREPRISE || ''}`,
    `STRIPE_WEBHOOK_SECRET=${webhookSecret}`,
  ].join('\n') + '\n')
}

const env = merge(
  loadEnv(resolve(root, '.env')),
  loadEnv(resolve(root, '.env.local')),
  loadEnv(resolve(root, '.stripe-setup.env')),
  loadEnv(resolve(root, '.stripe-setup.local.env')),
)

const stripeKey = env.STRIPE_SECRET_KEY
const publishable = env.STRIPE_PUBLISHABLE_KEY || env.VITE_STRIPE_PUBLISHABLE_KEY
let webhookSecret = env.STRIPE_WEBHOOK_SECRET
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const prices = {
  starter: env.VITE_STRIPE_PRICE_STARTER || env.STRIPE_PRICE_STARTER,
  pro: env.VITE_STRIPE_PRICE_PRO || env.STRIPE_PRICE_PRO,
  entreprise: env.VITE_STRIPE_PRICE_ENTREPRISE || env.STRIPE_PRICE_ENTREPRISE,
}

requireOrExit(stripeKey?.startsWith('sk_'), 'STRIPE_SECRET_KEY manquante → .stripe-setup.local.env')
requireOrExit(publishable?.startsWith('pk_'), 'Clé publishable Stripe manquante')
requireOrExit(anonKey, 'VITE_SUPABASE_ANON_KEY manquante → .env.local')
requireOrExit(prices.pro, 'Price ID Pro manquant → .stripe-setup.env')

console.log('=== BuildEasy — configuration production ===\n')

// 1. Vercel auth
try {
  const user = await vercelApi('/v2/user')
  console.log(`→ Vercel : ${user.user?.username || user.user?.email || 'connecté'}`)
} catch (e) {
  console.error('❌ Vercel API :', e.message)
  console.error('   Lancez : vercel login')
  process.exit(1)
}

// 2. Stripe webhook
console.log('\n→ Webhook Stripe…')
try {
  webhookSecret = await ensureStripeWebhook(stripeKey, webhookSecret)
  saveStripeSetupEnv({ publishable, prices, webhookSecret })
  console.log('  ✓ Webhook secret OK (.stripe-setup.env mis à jour)')
} catch (e) {
  console.error('❌ Stripe :', e.message)
  process.exit(1)
}

// 3. Supabase secrets
console.log('\n→ Secrets Supabase Edge Functions…')
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
  console.error('\n❌ Secrets Supabase — lancez : npx supabase login')
  process.exit(1)
}
console.log('  ✓ Secrets Supabase OK')

// 4. Vercel env vars
console.log('\n→ Variables Vercel…')
const vercelVars = {
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: anonKey,
  VITE_DEMO_MODE: 'false',
  VITE_STRIPE_PUBLISHABLE_KEY: publishable,
  VITE_STRIPE_PRICE_STARTER: prices.starter,
  VITE_STRIPE_PRICE_PRO: prices.pro,
  VITE_STRIPE_PRICE_ENTREPRISE: prices.entreprise,
}
const targets = ['production', 'preview', 'development']
for (const [key, val] of Object.entries(vercelVars)) {
  try {
    const action = await upsertVercelEnv(key, val, targets)
    console.log(`  ✓ ${key} (${action})`)
  } catch (e) {
    console.error(`  ❌ ${key} :`, e.message)
    process.exit(1)
  }
}

// 5. Deploy
if (deploy) {
  console.log('\n→ Déploiement Vercel production…')
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: root })
    execSync('npx vercel deploy --prebuilt --prod --yes', { stdio: 'inherit', cwd: root })
  } catch {
    execSync('npx vercel --prod --yes', { stdio: 'inherit', cwd: root })
  }
}

// 6. Smoke tests
console.log('\n→ Vérifications…')
const checks = [
  ['stripe-checkout', `${SUPABASE_URL}/functions/v1/stripe-checkout?plan=pro`, [401, 503]],
  ['stripe-portal', `${SUPABASE_URL}/functions/v1/stripe-portal`, [401, 503]],
  ['stripe-webhook', `${SUPABASE_URL}/functions/v1/stripe-webhook`, [400, 503]],
]
for (const [name, url, ok] of checks) {
  try {
    const r = await fetch(url)
    if (ok.includes(r.status)) console.log(`  ✓ ${name} → HTTP ${r.status}`)
    else console.log(`  ⚠ ${name} → HTTP ${r.status} (attendu ${ok.join('/')})`)
  } catch (e) {
    console.log(`  ⚠ ${name} → ${e.message}`)
  }
}

try {
  const r = await fetch('https://buildeasy.vercel.app/', { method: 'HEAD' })
  console.log(`  ${r.status === 200 ? '✓' : '⚠'} buildeasy.vercel.app → HTTP ${r.status}`)
} catch (e) {
  console.log(`  ⚠ buildeasy.vercel.app → ${e.message}`)
}

console.log('\n✅ Configuration terminée.')
console.log('   Test : https://buildeasy.vercel.app/app → Plus → Mon abonnement')
console.log('   Carte test Stripe : 4242 4242 4242 4242')
