-- BuildEasy — Schéma Supabase
-- Exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- Chaque utilisateur authentifié ne voit que les données de son organisation (RLS).

-- Extensions
create extension if not exists "pgcrypto";

-- ─── Organisations & profils ───────────────────────────────────────────────

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon entreprise',
  plan_id text not null default 'starter' check (plan_id in ('starter', 'pro', 'entreprise')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text not null,
  role text not null check (role in ('admin', 'chef', 'employe', 'client')),
  email text not null,
  ch_ids bigint[] not null default '{}',
  vierge boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_org_id_idx on public.profiles (org_id);

-- Org courante de l'utilisateur connecté (security invoker)
create or replace function public.user_org_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select org_id from public.profiles where id = (select auth.uid())
$$;

-- Nouvel utilisateur → organisation + profil gérant
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  user_nom text;
  user_role text;
begin
  user_nom := coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1));
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'admin');

  insert into public.organizations (name, plan_id)
  values (coalesce(new.raw_user_meta_data ->> 'org_name', user_nom || ' — BuildEasy'), 'starter')
  returning id into new_org_id;

  insert into public.profiles (id, org_id, nom, role, email, ch_ids, vierge)
  values (
    new.id,
    new_org_id,
    user_nom,
    user_role,
    new.email,
    '{}',
    coalesce((new.raw_user_meta_data ->> 'vierge')::boolean, true)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Tables métier (toutes scopées par org_id) ─────────────────────────────

create table if not exists public.chantiers (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  client text default '',
  tel text default '',
  corps text default '',
  statut text default 'planif',
  av int default 0,
  budget numeric default 0,
  dep numeric default 0,
  debut text default '',
  fin text default '',
  rdv text default '',
  meteo text default '—',
  prio int default 2,
  note text default '',
  adresse text default '',
  taux numeric default 35,
  created_at timestamptz not null default now()
);

create table if not exists public.taches (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  titre text default '',
  resp text default '',
  debut text default '',
  fin text default '',
  statut text default 'planif',
  prio int default 2,
  duree int default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.factures (
  id text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  client text default '',
  mt numeric default 0,
  statut text default 'emise',
  date text default '',
  ech text default '',
  description text default ''
);

create table if not exists public.equipe (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  fn text default '',
  tel text default '',
  ch_ids bigint[] default '{}',
  statut text default 'present',
  taux_h numeric default 35,
  qual text default ''
);

create table if not exists public.heures (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  ch_id bigint references public.chantiers (id) on delete set null,
  date text default '',
  arr text default '',
  dep text default '',
  pause int default 0,
  description text default '',
  val boolean default false,
  panier boolean default false,
  trajet boolean default false,
  zone int default 1
);

create table if not exists public.commandes (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ref text default '',
  ch_id bigint references public.chantiers (id) on delete set null,
  fournisseur text default '',
  fournisseur_id bigint,
  objet text default '',
  mt numeric default 0,
  statut text default 'attente',
  date text default '',
  livraison text default '',
  valide_par text default '',
  urgent boolean default false
);

create table if not exists public.devis (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ref text default '',
  client text default '',
  objet text default '',
  date text default '',
  validite text default '',
  statut text default 'brouillon',
  lots jsonb not null default '[]'::jsonb,
  remise numeric default 0,
  tva numeric default 20
);

create table if not exists public.incidents (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  ref text default '',
  type text default 'autre',
  description text default '',
  prio int default 2,
  statut text default 'ouvert',
  sig text default '',
  date text default '',
  screen text default '',
  ts bigint default (extract(epoch from now()) * 1000)::bigint,
  ref_cmd bigint,
  fournisseur_id bigint,
  bloquant boolean default false
);

create table if not exists public.avenants (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  ref text default '',
  titre text default '',
  description text default '',
  mt numeric default 0,
  statut text default 'attente',
  dc text default '',
  ds text default '',
  par text default ''
);

create table if not exists public.situations (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  ref text default '',
  num int default 1,
  titre text default '',
  av int default 0,
  mt numeric default 0,
  statut text default 'emise',
  date text default '',
  ech text default '',
  description text default ''
);

create table if not exists public.rapports (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  date text default '',
  auteur text default '',
  meteo text default '',
  av text default '',
  incidents text default 'RAS',
  presences jsonb default '[]'::jsonb
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  auteur text default '',
  role text default '',
  txt text default '',
  h text default '',
  d text default ''
);

create table if not exists public.clients (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  tel text default '',
  email text default '',
  adresse text default '',
  statut text default 'prospect',
  ca numeric default 0,
  nb_chantiers int default 0,
  note text default ''
);

create table if not exists public.fournisseurs (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  tel text default '',
  cat text default 'materiaux',
  url text default ''
);

create table if not exists public.conges (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  type text default 'conge',
  debut text default '',
  fin text default '',
  jours int default 1,
  statut text default 'attente',
  motif text default ''
);

create table if not exists public.agenda (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  date text default '',
  heure text default '',
  titre text default '',
  ch_id bigint references public.chantiers (id) on delete set null,
  type text default 'reunion',
  duree int default 60,
  lieu text default '',
  pour text default ''
);

create table if not exists public.punch (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  ref text default '',
  titre text default '',
  description text default '',
  corps text default '',
  prio int default 2,
  statut text default 'ouvert',
  sig text default '',
  date text default '',
  clos text default '',
  ass text default ''
);

create table if not exists public.notes (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ch_id bigint references public.chantiers (id) on delete set null,
  auteur text default '',
  txt text default '',
  ts bigint default (extract(epoch from now()) * 1000)::bigint,
  date text default ''
);

create table if not exists public.planning_eq (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  nom text default '',
  sem jsonb not null default '[]'::jsonb
);

-- Index org_id
do $$
declare t text;
begin
  foreach t in array array[
    'chantiers','taches','factures','equipe','heures','commandes','devis',
    'incidents','avenants','situations','rapports','messages','clients',
    'fournisseurs','conges','agenda','punch','notes','planning_eq'
  ] loop
    execute format(
      'create index if not exists %I_org_id_idx on public.%I (org_id)',
      t, t
    );
  end loop;
end $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'chantiers','taches','factures','equipe','heures','commandes','devis',
    'incidents','avenants','situations','rapports','messages','clients',
    'fournisseurs','conges','agenda','punch','notes','planning_eq'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Organizations : lecture / mise à jour de sa propre org
create policy "org_select_own" on public.organizations
  for select to authenticated
  using (id = public.user_org_id());

create policy "org_update_own" on public.organizations
  for update to authenticated
  using (id = public.user_org_id())
  with check (id = public.user_org_id());

-- Profiles : membres de la même org
create policy "profiles_select_org" on public.profiles
  for select to authenticated
  using (org_id = public.user_org_id());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and org_id = public.user_org_id());

-- Politique générique org pour toutes les tables métier
do $$
declare t text;
begin
  foreach t in array array[
    'chantiers','taches','factures','equipe','heures','commandes','devis',
    'incidents','avenants','situations','rapports','messages','clients',
    'fournisseurs','conges','agenda','punch','notes','planning_eq'
  ] loop
    execute format('drop policy if exists "org_all" on public.%I', t);
    execute format(
      $p$
      create policy "org_all" on public.%I
        for all to authenticated
        using (org_id = public.user_org_id())
        with check (org_id = public.user_org_id())
      $p$,
      t
    );
  end loop;
end $$;

-- ─── Accès API (Data API) ─────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- ─── Annuaire fournisseurs par défaut (à la création d'une org) ───────────

create or replace function public.seed_fournisseurs_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.fournisseurs where org_id = p_org_id limit 1) then
    return;
  end if;
  insert into public.fournisseurs (org_id, nom, tel, cat, url) values
    (p_org_id, 'Point P', '3616', 'materiaux', 'https://www.pointp.fr'),
    (p_org_id, 'Cedeo', '3633', 'plomberie', 'https://www.cedeo.fr'),
    (p_org_id, 'Weber', '01 41 85 25 25', 'enduits', 'https://www.weber.fr'),
    (p_org_id, 'BigMat', '0811 888 111', 'materiaux', 'https://www.bigmat.fr'),
    (p_org_id, 'Rexel', '0800 600 700', 'electricite', 'https://www.rexel.fr'),
    (p_org_id, 'Kiloutou', '3645', 'location', 'https://www.kiloutou.fr');
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  user_nom text;
  user_role text;
begin
  user_nom := coalesce(new.raw_user_meta_data ->> 'nom', split_part(new.email, '@', 1));
  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'admin');

  insert into public.organizations (name, plan_id)
  values (coalesce(new.raw_user_meta_data ->> 'org_name', user_nom || ' — BuildEasy'), 'starter')
  returning id into new_org_id;

  insert into public.profiles (id, org_id, nom, role, email, ch_ids, vierge)
  values (
    new.id,
    new_org_id,
    user_nom,
    user_role,
    new.email,
    '{}',
    coalesce((new.raw_user_meta_data ->> 'vierge')::boolean, true)
  );

  perform public.seed_fournisseurs_for_org(new_org_id);
  return new;
end;
$$;
