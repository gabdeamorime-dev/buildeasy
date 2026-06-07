# Configuration Supabase — BuildEasy

## 1. Exécuter le schéma SQL

1. Ouvrez [Supabase Dashboard](https://supabase.com/dashboard/project/nvgemgfeaxqocrmzdmzy/sql/new)
2. Collez le contenu de **`schema.sql`**
3. Cliquez **Run**

Cela crée les tables, le RLS (isolation par organisation) et le trigger d’inscription.

## 2. Variables d’environnement (Vite)

Le fichier **`app/.env`** est déjà configuré avec :

```env
VITE_SUPABASE_URL=https://nvgemgfeaxqocrmzdmzy.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_publishable
```

> En Vite, utilisez le préfixe **`VITE_`** (pas seulement `NEXT_PUBLIC_`).

Redémarrez le serveur après modification : `npm run dev`

## 3. Créer les utilisateurs (Auth)

Dans **Authentication → Users → Add user**, créez par exemple :

| Email | Mot de passe | User metadata (JSON) |
|-------|--------------|----------------------|
| admin@buildeasy.eu | admin123 | `{"nom":"Jean Dupont","role":"admin","vierge":false}` |
| chef@buildeasy.eu | chef123 | `{"nom":"Marc Lefebvre","role":"chef","vierge":false,"ch_ids":[1,5]}` |

À la première connexion, un **profil** et une **organisation** sont créés automatiquement.

### Équipe sur la même organisation

Pour que chef / employé / client voient les **mêmes chantiers** :

1. Connectez-vous une fois avec le compte **admin** (notez l’`org_id` dans **Table Editor → profiles**)
2. Pour les autres comptes, après création Auth, mettez à jour leur ligne dans **`profiles`** :

```sql
update public.profiles
set org_id = 'UUID-ORG-DU-GERANT',
    role = 'chef',
    ch_ids = '{1,5}'
where email = 'chef@buildeasy.eu';
```

## 4. Données de démo (optionnel)

Les anciennes données `D_CH`, `D_TACHES`, etc. ne sont plus chargées automatiquement.  
Chaque organisation part **vide** (`vierge: true` par défaut).

Pour importer des données de test, utilisez l’éditeur SQL ou l’API en insérant des lignes avec le bon **`org_id`**.

## 5. Isolation des données (RLS)

Chaque table métier a une colonne **`org_id`**.  
Les politiques RLS limitent l’accès à `org_id = user_org_id()` : un utilisateur ne voit que les données de **son entreprise**.

## 6. Lancer l’app

```bash
cd app
npm install
npm run dev
```

Connexion avec email + mot de passe Supabase Auth (plus de vérification locale `COMPTES` / `mdp`).
