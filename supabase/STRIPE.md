# Stripe — BuildEasy (préparation)

Quand votre compte Stripe est prêt, suivez ces étapes.

## 1. Produits et prix Stripe

Dans [Stripe Dashboard → Products](https://dashboard.stripe.com/products), créez 3 abonnements mensuels :

| Plan | Suggestion prix | Variable Vercel |
|------|-----------------|-----------------|
| Starter | 29 €/mois | `VITE_STRIPE_PRICE_STARTER` |
| Pro | 59 €/mois | `VITE_STRIPE_PRICE_PRO` |
| Entreprise | 99 €/mois | `VITE_STRIPE_PRICE_ENTREPRISE` |

Copiez chaque **Price ID** (`price_...`).

## 2. Variables d'environnement

### Frontend (Vercel / `.env`)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PRICE_STARTER=price_...
VITE_STRIPE_PRICE_PRO=price_...
VITE_STRIPE_PRICE_ENTREPRISE=price_...
```

### Supabase Edge Functions (secrets)

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_STARTER=price_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_ENTREPRISE=price_...
```

## 3. Edge Functions (à déployer)

Le code est dans `supabase/functions/` :

- `stripe-checkout` — crée une session Checkout pour upgrader le plan
- `stripe-portal` — portail client (gérer carte, factures, annulation)
- `stripe-webhook` — met à jour `billing_subscriptions` et `organizations.plan_id`

```bash
cd buildeasy
supabase link --project-ref nvgemgfeaxqocrmzdmzy
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook
```

## 4. Webhook Stripe

URL : `https://nvgemgfeaxqocrmzdmzy.supabase.co/functions/v1/stripe-webhook`

Événements à écouter :

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## 5. Table billing

La table `billing_subscriptions` lie chaque `org_id` à un client Stripe.  
Elle est créée par `supabase/signup.sql`.

## 6. Dans l'app

`src/lib/stripe.js` expose :

- `stripeCheckoutUrl(planId)` — lien vers Checkout
- `stripePortalUrl()` — portail abonnement
- `isStripeConfigured` — true si clé publishable + au moins un price ID

L'écran **Paramètres → Abonnement** affichera les boutons Stripe une fois les variables configurées.

## Essai gratuit

Les nouveaux comptes sont créés avec `plan_id = starter` et `billing_subscriptions.status = trialing`.  
Configurez dans Stripe un essai de 14 jours sur le prix Starter si vous le souhaitez.
