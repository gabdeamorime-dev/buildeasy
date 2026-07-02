/**
 * Stripe — Checkout Sessions + portail client (Edge Functions Supabase).
 * Variables : VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_PRICE_*, VITE_SUPABASE_URL
 */

import { supabase } from '../supabase.js'

const PUBLISHABLE = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
const PRICE_STARTER = import.meta.env.VITE_STRIPE_PRICE_STARTER || ''
const PRICE_PRO = import.meta.env.VITE_STRIPE_PRICE_PRO || ''
const PRICE_ENTREPRISE = import.meta.env.VITE_STRIPE_PRICE_ENTREPRISE || ''

export const isStripeConfigured = Boolean(PUBLISHABLE && (PRICE_STARTER || PRICE_PRO))

const PRICE_BY_PLAN = {
  starter: PRICE_STARTER,
  pro: PRICE_PRO,
  entreprise: PRICE_ENTREPRISE,
}

export const BILLING_STATUS_LABELS = {
  trialing: 'Essai gratuit',
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Annulé',
  unpaid: 'Impayé',
  incomplete: 'En attente',
}

/** URL checkout Stripe (Edge Function Supabase) */
export function stripeCheckoutUrl(planId = 'pro') {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return null
  return `${base}/functions/v1/stripe-checkout?plan=${encodeURIComponent(planId)}`
}

export function stripePortalUrl() {
  const base = import.meta.env.VITE_SUPABASE_URL
  if (!base) return null
  return `${base}/functions/v1/stripe-portal`
}

export function planPriceId(planId) {
  return PRICE_BY_PLAN[planId] || null
}

async function callStripeFunction(url) {
  if (!url) throw new Error('Stripe non configuré')
  if (!supabase) throw new Error('Supabase non configuré')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Session expirée — reconnectez-vous')
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Erreur Stripe (${r.status})`)
  if (!j.url) throw new Error('URL de paiement indisponible')
  return j.url
}

export async function startStripeCheckout(planId = 'pro') {
  const url = await callStripeFunction(stripeCheckoutUrl(planId))
  window.location.href = url
}

export async function startStripePortal() {
  const url = await callStripeFunction(stripePortalUrl())
  window.location.href = url
}
