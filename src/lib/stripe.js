/**
 * Préparation Stripe — à brancher quand le compte Stripe est prêt.
 * Variables Vercel : VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_PRICE_STARTER, etc.
 */

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

/** URL checkout Stripe (Edge Function à déployer côté Supabase) */
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
