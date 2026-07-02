# Stripe — BuildEasy (configuration complète)

## Architecture

```
App Vercel (React)
  └─ Plus → Mon abonnement → stripe.js
       ├─ stripe-checkout  (Supabase Edge Function, JWT requis)
       ├─ stripe-portal    (Supabase Edge Function, JWT requis)
       └─ stripe-webhook   (Stripe → Supabase, signature requise)
            └─ billing_subscriptions + organizations.plan_id
```

## 1. Créer les produits Stripe (automatisé)

```bash
cd buildeasy
STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.mjs
```

Crée 3 abonnements mensuels (alignés sur l'app) :

| Plan | Prix app | Variable |
|------|----------|----------|
| Starter | 80 €/mois | `VITE_STRIPE_PRICE_STARTER` |
| Pro | 149 €/mois | `VITE_STRIPE_PRICE_PRO` |
| Entreprise | 249 €/mois | `VITE_STRIPE_PRICE_ENTREPRISE` |

Les Price IDs sont écrits dans `.stripe-setup.env` (gitignored).

## Configuration rapide (une commande)

```bash
cd buildeasy
vercel login          # une fois
npx supabase login    # une fois
npm run configure:prod:deploy
```

Ce script configure :
- **Secrets Supabase** (Stripe secret, webhook, price IDs)
- **Variables Vercel** (Supabase URL + anon key, Stripe, `VITE_DEMO_MODE=false`)
- **Déploiement** production

Vérification : `npm run stripe:verify`

## 2. Variables Vercel (frontend) — détail manuel

Dans [Vercel → buildeasy → Settings → Environment Variables](https://vercel.com) :

```env
VITE_SUPABASE_URL=https://nvgemgfeaxqocrmzdmzy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_DEMO_MODE=false
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PRICE_STARTER=price_...
VITE_STRIPE_PRICE_PRO=price_...
VITE_STRIPE_PRICE_ENTREPRISE=price_...
```

Puis redéployer : `vercel --prod`

## 3. Secrets Supabase (Edge Functions)

```bash
npx supabase secrets set --project-ref nvgemgfeaxqocrmzdmzy \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_STARTER=price_... \
  STRIPE_PRICE_PRO=price_... \
  STRIPE_PRICE_ENTREPRISE=price_...
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.

## 4. Edge Functions (déjà déployées)

| Function | URL | JWT |
|----------|-----|-----|
| stripe-checkout | `.../functions/v1/stripe-checkout?plan=pro` | Oui |
| stripe-portal | `.../functions/v1/stripe-portal` | Oui |
| stripe-webhook | `.../functions/v1/stripe-webhook` | Non |

Redéployer si besoin : `bash scripts/deploy-stripe.sh`

## 5. Webhook Stripe Dashboard

1. [Stripe → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. **Add endpoint** : `https://nvgemgfeaxqocrmzdmzy.supabase.co/functions/v1/stripe-webhook`
3. Événements :
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copier le **Signing secret** (`whsec_...`) → secret Supabase `STRIPE_WEBHOOK_SECRET`

## 6. Portail client Stripe

[Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal) — activer annulation, changement de plan, historique factures.

## 7. Dans l'app

- **Plus → Mon abonnement** : statut réel (`trialing`, `active`, `past_due`), choix de formule → Checkout Stripe
- Retour paiement : `/app?checkout=success` ou `cancel`
- Essai gratuit : 14 jours sur chaque checkout (configuré dans `stripe-checkout`)
- Nouvelle inscription : ligne `billing_subscriptions` créée automatiquement (`finish_signup`)

## Checklist go-live

- [ ] `node scripts/setup-stripe.mjs` exécuté
- [ ] Variables Vercel configurées + `VITE_DEMO_MODE=false`
- [ ] Secrets Supabase configurés
- [ ] Webhook Stripe créé et secret copié
- [ ] Test checkout en mode test (`4242 4242 4242 4242`)
- [ ] Vérifier `billing_subscriptions` mis à jour après paiement
