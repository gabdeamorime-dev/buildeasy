#!/usr/bin/env node
/**
 * Crée les produits/prix Stripe BuildEasy et affiche les variables à configurer.
 * Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Définissez STRIPE_SECRET_KEY (clé secrète test ou live).')
  process.exit(1)
}

const PLANS = [
  { id: 'starter', name: 'BuildEasy Starter', amount: 8000, desc: 'Artisans et petites équipes — 5 users, 3 chantiers' },
  { id: 'pro', name: 'BuildEasy Pro', amount: 14900, desc: 'PME — 20 users, chantiers illimités' },
  { id: 'entreprise', name: 'BuildEasy Entreprise', amount: 24900, desc: 'Entreprises en croissance — illimité' },
]

const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }

async function stripePost(path, params) {
  const body = new URLSearchParams(params)
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers, body })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j))
  return j
}

async function stripeGet(path, query = '') {
  const r = await fetch(`https://api.stripe.com/v1/${path}${query}`, { headers: { Authorization: `Bearer ${key}` } })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j))
  return j
}

async function findOrCreateProduct(plan) {
  const existing = await stripeGet('products', `?limit=100&active=true`)
  const found = existing.data?.find((p) => p.metadata?.buildeasy_plan === plan.id)
  if (found) return found
  return stripePost('products', {
    name: plan.name,
    description: plan.desc,
    'metadata[buildeasy_plan]': plan.id,
  })
}

async function findOrCreatePrice(productId, plan) {
  const existing = await stripeGet('prices', `?product=${productId}&active=true&limit=10`)
  const found = existing.data?.find((p) => p.unit_amount === plan.amount && p.recurring?.interval === 'month')
  if (found) return found
  return stripePost('prices', {
    product: productId,
    unit_amount: String(plan.amount),
    currency: 'eur',
    'recurring[interval]': 'month',
    'metadata[buildeasy_plan]': plan.id,
  })
}

const prices = {}
for (const plan of PLANS) {
  const product = await findOrCreateProduct(plan)
  const price = await findOrCreatePrice(product.id, plan)
  prices[plan.id] = price.id
  console.log(`✓ ${plan.name} → ${price.id} (${plan.amount / 100} €/mois)`)
}

const publishable = await stripeGet('balance').then(() => null).catch(() => null)
void publishable

console.log('\n--- Variables Vercel (frontend) ---')
console.log(`VITE_STRIPE_PUBLISHABLE_KEY=pk_...  # Dashboard → Developers → API keys`)
console.log(`VITE_STRIPE_PRICE_STARTER=${prices.starter}`)
console.log(`VITE_STRIPE_PRICE_PRO=${prices.pro}`)
console.log(`VITE_STRIPE_PRICE_ENTREPRISE=${prices.entreprise}`)
console.log(`VITE_DEMO_MODE=false`)

console.log('\n--- Secrets Supabase Edge Functions ---')
console.log(`STRIPE_SECRET_KEY=${key.slice(0, 12)}...`)
console.log(`STRIPE_PRICE_STARTER=${prices.starter}`)
console.log(`STRIPE_PRICE_PRO=${prices.pro}`)
console.log(`STRIPE_PRICE_ENTREPRISE=${prices.entreprise}`)
console.log('STRIPE_WEBHOOK_SECRET=whsec_...  # après création du webhook Stripe')

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.stripe-setup.env')
const content = [
  `# Généré par scripts/setup-stripe.mjs — ne pas committer`,
  `VITE_STRIPE_PRICE_STARTER=${prices.starter}`,
  `VITE_STRIPE_PRICE_PRO=${prices.pro}`,
  `VITE_STRIPE_PRICE_ENTREPRISE=${prices.entreprise}`,
  `STRIPE_PRICE_STARTER=${prices.starter}`,
  `STRIPE_PRICE_PRO=${prices.pro}`,
  `STRIPE_PRICE_ENTREPRISE=${prices.entreprise}`,
].join('\n') + '\n'
writeFileSync(outPath, content)
console.log(`\n→ Price IDs sauvegardés dans .stripe-setup.env`)
