# BuildEasy — Déploiement SaaS

Guide pour passer de la démo locale à un **vrai SaaS multi-tenant** sur Supabase.

## Prérequis

- Compte [Supabase](https://supabase.com)
- Node.js 18+
- Variables d'environnement (voir `.env.example`)

## 1. Créer le projet Supabase

1. Nouveau projet → noter **URL** et **anon key**
2. Authentication → Providers → Email : activer, désactiver « Confirm email » en dev
3. Copier `.env.example` → `.env` et remplir :

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_DEMO_MODE=false
```

## 2. Exécuter les migrations SQL

Dans **SQL Editor**, dans cet ordre :

| Fichier | Rôle |
|---------|------|
| `supabase/schema.sql` | Tables MVP + seed chantiers |
| `supabase/auth.sql` | Profils + trigger inscription |
| `supabase/saas.sql` | Multi-tenant, nouvelles tables, **RLS strict** |
| `supabase/saas-seed.sql` | Organisation démo + rattachement |
| `supabase/seed-profiles.sql` | Rôles des comptes Auth |

## 3. Créer les utilisateurs Auth

Dashboard → Authentication → Users → Add user :

| Email | Mot de passe | Rôle (metadata) |
|-------|--------------|-----------------|
| admin@buildeasy.eu | admin123 | admin |
| chef@buildeasy.eu | chef123 | chef |
| ali@buildeasy.eu | employe123 | employe |
| client@buildeasy.eu | client123 | client |
| demo1@buildeasy.eu | buildeasy | employe (vierge) |

Puis exécuter `seed-profiles.sql` et `saas-seed.sql`.

## 4. Lancer l'application

```bash
npm install
npm run dev
```

- **Mode démo local** : `VITE_DEMO_MODE=true` → comptes `COMPTES` dans l'app, données en localStorage
- **Mode SaaS** : connexion Supabase → données en base, RLS par org + rôle + chantiers assignés

## Architecture données

```
Utilisateur connecté
       ↓
  profiles (org_id, role, chantier_ids)
       ↓
  RLS Supabase (isolation par organisation)
       ↓
  App.jsx ← loadAppDataForUi() ← db.js
       ↓
  localStorage (cache offline uniquement pour comptes cloud)
```

## Sécurité production

- [ ] RLS activé (`saas.sql`) — **ne pas** réactiver `USING (true)`
- [ ] Clé `service_role` uniquement côté serveur / scripts
- [ ] `VITE_DEMO_MODE=false` en production
- [ ] Activer confirmation email
- [ ] Configurer SMTP pour invitations

## Plans & limites

Les plans (`starter`, `pro`, `entreprise`) sont stockés sur `organizations.plan_id`.
L'app applique les limites UI (ex. 3 chantiers actifs sur Starter).

## Nouveau tenant (client SaaS)

1. Créer une ligne dans `organizations`
2. Créer l'utilisateur admin via Auth
3. Mettre à jour son `profiles.org_id` et `role = 'admin'`
4. L'utilisateur crée chantiers / équipe depuis l'app

## Build production

```bash
npm run build
# Déployer dist/ sur Vercel, Netlify, ou CDN
```

Variables requises sur l'hébergeur : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
