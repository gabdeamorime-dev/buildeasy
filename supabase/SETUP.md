# Configuration Supabase — BuildEasy

## 1. Schéma SQL (ordre d'exécution)

Dans [SQL Editor](https://supabase.com/dashboard/project/nvgemgfeaxqocrmzdmzy/sql/new) :

1. `schema.sql` — tables de base
2. `auth.sql` — trigger profil à l'inscription Auth
3. `saas.sql` — multi-tenant + RLS
4. `migrate-to-org.sql` — colonnes `org_id` sur les tables métier
5. `signup.sql` — inscription SaaS (`finish_signup`, billing Stripe)

## 2. Variables d'environnement (Vite)

```env
VITE_SUPABASE_URL=https://nvgemgfeaxqocrmzdmzy.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_publishable
VITE_DEMO_MODE=false
```

Redémarrez après modification : `npm run dev`

## 3. Inscription utilisateur (dans l'app)

L'écran de connexion propose **Créer un compte** :

- Nom de l'entreprise
- Votre nom
- Email + mot de passe (8 caractères min.)

À l'inscription :

1. Supabase Auth crée l'utilisateur
2. Le trigger `handle_new_user` crée le profil (rôle `admin`, compte vierge)
3. `finish_signup` crée l'organisation et lie le profil
4. Les données sont synchronisées vers Supabase (chantiers, devis, etc.)

> Si la confirmation email est activée dans Supabase Auth, l'utilisateur doit confirmer avant de se connecter.

### Désactiver la confirmation email (dev / MVP)

**Authentication → Providers → Email** → désactiver « Confirm email ».

## 4. Comptes démo (optionnel)

Avec `VITE_DEMO_MODE=true`, les comptes locaux restent disponibles pour les démos sans cloud.

## 5. Isolation des données

Chaque entreprise a un `org_id`. Les politiques RLS limitent l'accès aux données de l'organisation de l'utilisateur connecté.

## 6. Stripe (abonnements)

Voir **`STRIPE.md`** pour configurer les prix, webhooks et Edge Functions.

## 7. Lancer l'app

```bash
cd buildeasy
npm install
npm run dev
```

Connexion : email + mot de passe Supabase, ou inscription depuis l'app.

## 8. Erreur « database error saving new user » à l'inscription

Si l'app affiche une erreur base de données à l'inscription, le trigger Auth n'est pas à jour.

**Correctif (1 minute) :**

1. Ouvrir le [SQL Editor Supabase](https://supabase.com/dashboard/project/nvgemgfeaxqocrmzdmzy/sql/new)
2. Copier-coller le contenu de `supabase/migrations/20260623_fix_signup_trigger.sql`
3. Cliquer **Run**
4. Réessayer l'inscription

**En local (si `.env` contient `DATABASE_URL`) :**

```bash
npm run db:fix-signup
```

Le mot de passe Postgres se trouve dans Supabase → **Project Settings → Database → Connection string**.
