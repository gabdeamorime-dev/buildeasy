import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { corsHeaders, safeAppOrigin } from '../_shared/http.ts'
import { requireAdminUser } from '../_shared/auth.ts'

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe non configuré' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })

    const authResult = await requireAdminUser(req)
    if (authResult instanceof Response) {
      return new Response(await authResult.text(), {
        status: authResult.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const { user, profile } = authResult

    const url = new URL(req.url)
    const plan = url.searchParams.get('plan') || 'pro'
    const priceMap: Record<string, string | undefined> = {
      starter: Deno.env.get('STRIPE_PRICE_STARTER'),
      pro: Deno.env.get('STRIPE_PRICE_PRO'),
      entreprise: Deno.env.get('STRIPE_PRICE_ENTREPRISE'),
    }
    const priceId = priceMap[plan]
    if (!priceId) return new Response(JSON.stringify({ error: 'Plan invalide' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: billing } = await admin.from('billing_subscriptions').select('stripe_customer_id').eq('org_id', profile.org_id).maybeSingle()

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const origin = safeAppOrigin(req)

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app?checkout=success`,
      cancel_url: `${origin}/app?checkout=cancel`,
      metadata: { org_id: profile.org_id, plan_id: plan, user_id: user.id },
      payment_method_collection: 'always',
      subscription_data: {
        trial_period_days: 15,
        metadata: { org_id: profile.org_id, plan_id: plan },
      },
    }

    if (billing?.stripe_customer_id) {
      sessionParams.customer = billing.stripe_customer_id
    } else {
      sessionParams.customer_email = profile.email || user.email || undefined
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
