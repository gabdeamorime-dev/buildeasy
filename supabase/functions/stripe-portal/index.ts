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

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: billing } = await admin.from('billing_subscriptions').select('stripe_customer_id').eq('org_id', profile.org_id).maybeSingle()

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    const origin = safeAppOrigin(req)

    let customerId = billing?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email || undefined, metadata: { org_id: profile.org_id } })
      customerId = customer.id
      await admin.from('billing_subscriptions').upsert({ org_id: profile.org_id, stripe_customer_id: customerId }, { onConflict: 'org_id' })
    }

    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/app` })
    return new Response(JSON.stringify({ url: portal.url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
