import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const cors = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature' }

async function assertOrgExists(admin: ReturnType<typeof createClient>, orgId: string) {
  const { data } = await admin.from('organizations').select('id').eq('id', orgId).maybeSingle()
  if (!data?.id) throw new Error('Organisation inconnue')
}

async function assertCustomerMatchesOrg(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  customerId: string | null | undefined,
) {
  if (!customerId) return
  const { data } = await admin
    .from('billing_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (data?.org_id && data.org_id !== orgId) {
    throw new Error('Client Stripe incompatible avec l\'organisation')
  }
}

function planFromPriceId(priceId: string): string | null {
  const map: Record<string, string | undefined> = {
    [Deno.env.get('STRIPE_PRICE_STARTER') ?? '']: 'starter',
    [Deno.env.get('STRIPE_PRICE_PRO') ?? '']: 'pro',
    [Deno.env.get('STRIPE_PRICE_ENTREPRISE') ?? '']: 'entreprise',
  }
  return map[priceId] ?? null
}

function planFromSubscription(sub: Stripe.Subscription): string | null {
  const priceId = sub.items.data[0]?.price?.id
  if (!priceId) return (sub.metadata?.plan_id as string) || null
  const fromPrice = planFromPriceId(priceId)
  if (fromPrice) return fromPrice
  return (sub.metadata?.plan_id as string) || null
}

async function syncOrgPlan(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  planId: string,
) {
  await admin.from('organizations').update({ plan_id: planId }).eq('id', orgId)
  await admin.from('profiles').update({ plan_id: planId }).eq('org_id', orgId)
}

async function upsertBilling(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  fields: {
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
    plan_id?: string
    status?: string
    current_period_end?: string | null
  },
) {
  const { plan_id, ...rest } = fields
  const row: Record<string, unknown> = {
    org_id: orgId,
    updated_at: new Date().toISOString(),
    ...rest,
  }
  if (plan_id) row.plan_id = plan_id

  await admin.from('billing_subscriptions').upsert(row, { onConflict: 'org_id' })

  if (plan_id) await syncOrgPlan(admin, orgId, plan_id)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Stripe webhook non configuré' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Signature manquante' }), { status: 400 })
    }

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        if (!orgId) break

        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        await assertOrgExists(admin, orgId)
        await assertCustomerMatchesOrg(admin, orgId, customerId)
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        const planId = session.metadata?.plan_id || 'starter'

        let status = 'active'
        let periodEnd: string | null = null

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          status = sub.status
          periodEnd = new Date(sub.current_period_end * 1000).toISOString()
        }

        await upsertBilling(admin, orgId, {
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
          plan_id: planId,
          status,
          current_period_end: periodEnd,
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await assertOrgExists(admin, orgId)
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        await assertCustomerMatchesOrg(admin, orgId, customerId)

        const planId = planFromSubscription(sub) ?? 'starter'
        await upsertBilling(admin, orgId, {
          stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripe_subscription_id: sub.id,
          plan_id: planId,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await assertOrgExists(admin, orgId)

        await upsertBilling(admin, orgId, {
          stripe_subscription_id: null,
          plan_id: 'starter',
          status: 'canceled',
          current_period_end: null,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (!subscriptionId) break

        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await assertOrgExists(admin, orgId)

        await upsertBilling(admin, orgId, {
          status: 'past_due',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Webhook error'
    console.error('stripe-webhook:', message)
    return new Response(JSON.stringify({ error: message }), { status: 400 })
  }
})
