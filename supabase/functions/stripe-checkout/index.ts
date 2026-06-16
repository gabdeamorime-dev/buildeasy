import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe non configuré' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })

    const url = new URL(req.url)
    const plan = url.searchParams.get('plan') || 'pro'
    const priceMap: Record<string, string | undefined> = {
      starter: Deno.env.get('STRIPE_PRICE_STARTER'),
      pro: Deno.env.get('STRIPE_PRICE_PRO'),
      entreprise: Deno.env.get('STRIPE_PRICE_ENTREPRISE'),
    }
    const priceId = priceMap[plan]
    if (!priceId) return new Response(JSON.stringify({ error: 'Plan invalide' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

    const auth = req.headers.get('Authorization')
    if (!auth) return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Session invalide' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const { data: profile } = await supabase.from('profiles').select('org_id, email').eq('id', user.id).single()
    if (!profile?.org_id) return new Response(JSON.stringify({ error: 'Organisation introuvable' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const origin = req.headers.get('origin') || 'https://buildeasy.vercel.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: profile.email || user.email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      metadata: { org_id: profile.org_id, plan_id: plan, user_id: user.id },
      subscription_data: { trial_period_days: 14, metadata: { org_id: profile.org_id, plan_id: plan } },
    })

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
