#!/usr/bin/env bash
# Déploie les Edge Functions Stripe sur Supabase BuildEasy
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-nvgemgfeaxqocrmzdmzy}"

echo "→ Liaison projet Supabase $PROJECT_REF"
npx supabase link --project-ref "$PROJECT_REF" 2>/dev/null || true

for fn in stripe-checkout stripe-portal stripe-webhook; do
  echo "→ Déploiement $fn"
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo ""
echo "✓ Edge Functions déployées."
echo "  Webhook URL: https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"
echo ""
echo "N'oubliez pas:"
echo "  1. supabase secrets set STRIPE_SECRET_KEY=sk_..."
echo "  2. supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_..."
echo "  3. supabase secrets set STRIPE_PRICE_STARTER=price_..."
echo "  4. supabase secrets set STRIPE_PRICE_PRO=price_..."
echo "  5. supabase secrets set STRIPE_PRICE_ENTREPRISE=price_..."
echo "  6. vercel env add (voir supabase/STRIPE.md)"
