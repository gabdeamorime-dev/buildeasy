#!/usr/bin/env node
/**
 * Affiche la checklist de configuration (sans exposer les secrets complets).
 * Usage: node scripts/print-config-checklist.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'nvgemgfeaxqocrmzdmzy'

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

function mask(v) {
  if (!v) return '— manquant'
  if (v.length <= 12) return '***'
  return v.slice(0, 8) + '…' + v.slice(-4)
}

const env = {
  ...loadEnv(resolve(root, '.env')),
  ...loadEnv(resolve(root, '.env.local')),
  ...loadEnv(resolve(root, '.stripe-setup.env')),
  ...loadEnv(resolve(root, '.stripe-setup.local.env')),
}

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  BuildEasy — checklist configuration production              ║
╚══════════════════════════════════════════════════════════════╝

Fichiers locaux détectés :
  STRIPE_SECRET_KEY      ${mask(env.STRIPE_SECRET_KEY)}
  STRIPE_WEBHOOK_SECRET  ${mask(env.STRIPE_WEBHOOK_SECRET)}
  VITE_STRIPE_PUBLISHABLE ${mask(env.VITE_STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY)}
  VITE_SUPABASE_ANON_KEY ${mask(env.VITE_SUPABASE_ANON_KEY)}
  Price Pro              ${env.VITE_STRIPE_PRICE_PRO || '— manquant'}

──────────────────────────────────────────────────────────────
1. SUPABASE — Secrets Edge Functions
   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions

   Ajouter / mettre à jour :
   • STRIPE_SECRET_KEY        ← .stripe-setup.local.env
   • STRIPE_WEBHOOK_SECRET    ← .stripe-setup.env
   • STRIPE_PRICE_STARTER     ← .stripe-setup.env
   • STRIPE_PRICE_PRO         ← .stripe-setup.env
   • STRIPE_PRICE_ENTREPRISE  ← .stripe-setup.env

   Edge Functions (v3 ACTIVE) :
   • stripe-checkout, stripe-portal, stripe-webhook ✓

──────────────────────────────────────────────────────────────
2. VERCEL — Environment Variables
   https://vercel.com/gabdeamorime-dev/buildeasy/settings/environment-variables

   Production + Preview + Development :
   • VITE_SUPABASE_URL=https://${PROJECT_REF}.supabase.co
   • VITE_SUPABASE_ANON_KEY   ← .env.local
   • VITE_DEMO_MODE=false
   • VITE_STRIPE_PUBLISHABLE_KEY ← .stripe-setup.env
   • VITE_STRIPE_PRICE_STARTER
   • VITE_STRIPE_PRICE_PRO
   • VITE_STRIPE_PRICE_ENTREPRISE

   Framework : Vite | Output : dist | Root : ./

──────────────────────────────────────────────────────────────
3. STRIPE — Webhook
   https://dashboard.stripe.com/test/webhooks

   URL : https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook
   Events : checkout.session.completed, customer.subscription.updated,
            customer.subscription.deleted, invoice.payment_failed

──────────────────────────────────────────────────────────────
4. Lancer la config automatique (Terminal macOS)

   cd ~/buildeasy
   ./scripts/run-config.command

   ou : npm run configure:prod:deploy

──────────────────────────────────────────────────────────────
5. Vérifier

   npm run stripe:verify
   https://buildeasy.vercel.app/app → Plus → Mon abonnement
   Carte test : 4242 4242 4242 4242
`)
