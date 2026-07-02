# BuildEasy — Rapport sécurité

Audit réalisé sur le code, la configuration Vercel/Supabase et les tests d’accès anonyme.

## Résumé

| Niveau | Avant | Après correctifs |
|--------|-------|------------------|
| Critique | 3 | 0* (après migration + deploy) |
| Élevé | 2 | 0* |
| Moyen | 8 | 2 (CSP inline, rate limit plateforme) |

\* Sous réserve d’appliquer la migration SQL et `VITE_DEMO_MODE=false` en prod.

---

## Correctifs appliqués dans le code

### Base de données (`20260622_security_lockdown.sql`)
- Suppression des politiques `allow_anon_*` et `org_update_own` héritées
- **REVOKE** accès `anon` sur toutes les tables métier
- Factures / situations : écriture **gérant uniquement**
- `list_org_invitations` : token masqué si invitation expirée/acceptée
- `ensure_org_referral_code` : accessible aux membres authentifiés (contrôle org interne), pas en anon

### Application
- Session : `getUser()` au lieu de `getSession()` (JWT validé côté serveur)
- Mots de passe démo exclus du bundle prod (`demoData.js` + `demoComptes.js`)
- URLs utilisateur : blocage `javascript:`, `data:` (`safeUrl.js`)
- Upload médias : liste MIME + limite 50 Mo côté client (bucket Supabase en backup)

### Stripe (edge functions)
- Checkout / portail : **réservés au rôle admin**
- Webhook : vérifie que l’`org_id` existe et correspond au client Stripe

### Fichiers sensibles
- `.stripe-setup.local.env` ajouté au `.gitignore`

---

## Tests automatisés

```bash
npm run security:audit   # scan secrets + tests API anon + XSS
npm run build            # vérifier absence de mots de passe démo (VITE_DEMO_MODE=false)
```

---

## À faire manuellement (obligatoire)

### 1. Appliquer la migration Supabase

Dans le terminal (projet lié) :

```bash
cd /Users/pomartange-line/buildeasy
supabase db push
```

Ou coller le contenu de `supabase/migrations/20260622_security_lockdown.sql` dans le SQL Editor Supabase.

### 2. Vercel — variables d’environnement

- `VITE_DEMO_MODE` = **`false`** (production)
- Ne jamais définir `SUPABASE_SERVICE_ROLE_KEY` côté Vercel client

### 3. Rotation clé Stripe (si `.stripe-setup.local.env` a été commité)

[Stripe Dashboard → API keys](https://dashboard.stripe.com/apikeys) → régénérer la clé secrète, mettre à jour Supabase Edge Function secrets.

### 4. Redéployer

```bash
npm run deploy
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook
```

### 5. Supabase Dashboard

- **Authentication → Rate limits** : activer / renforcer (brute-force login)
- **Database → Advisors → Security** : vérifier RLS sur toutes les tables
- **Storage → chantier-media** : bucket privé, policies actives

---

## Vecteurs testés

| Attaque | Résultat |
|---------|----------|
| Lecture données sans login (anon) | Bloqué par RLS (après migration) |
| RPC `finish_signup` / `ensure_org_referral_code` en anon | Bloqué |
| Élévation de rôle via `profiles` UPDATE | Bloqué (migration 20260621) |
| XSS via `javascript:` dans liens fournisseurs | Bloqué (`safeUrl`) |
| Mots de passe démo dans le JS prod | Exclus si `VITE_DEMO_MODE=false` |
| Stripe webhook forgé | Rejeté (signature HMAC) |
| Checkout Stripe par employé | Bloqué (admin only) |
| `service_role` dans le bundle | Absent |
| CSRF API Supabase | Faible risque (JWT Bearer, pas cookies) |

---

## Risques résiduels (acceptables ou plateforme)

1. **CSP `unsafe-inline`** — requis par Vite/React inline bootstrap ; atténué par pas de `innerHTML`
2. **Pas de rate limiting applicatif** — déléguer à Supabase Auth + WAF Vercel si besoin
3. **Données offline** (localStorage / IndexedDB) — chiffrées par l’OS de l’appareil uniquement
4. **`get_invitation_preview` en anon** — nécessaire pour le flux d’invitation ; token 48 car. hex

---

## Contact incident

En cas de fuite suspectée : support@buildeasy.eu — rotation immédiate des clés Supabase service_role et Stripe.
