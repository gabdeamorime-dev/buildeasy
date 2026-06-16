-- BuildEasy SaaS — Schéma multi-tenant + RLS par rôle/chantier
-- Ordre d'exécution : 1) schema.sql  2) auth.sql  3) saas.sql  4) saas-seed.sql

-- ─────────────────────────────────────────────
-- ORGANISATIONS (tenant)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL DEFAULT 'Mon entreprise',
  plan_id TEXT NOT NULL DEFAULT 'pro' CHECK (plan_id IN ('starter', 'pro', 'entreprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- PROFILS étendus
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS vierge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(org_id);

-- ─────────────────────────────────────────────
-- org_id sur tables métier existantes
-- ─────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chantiers','taches','factures','messages','avenants',
    'heures','punchlist','rapports','equipe'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE',
      t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org ON public.%I(org_id)', t, t);
  END LOOP;
END $$;

-- Colonnes UI manquantes
ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS rdv TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS taux_h NUMERIC DEFAULT 35;

ALTER TABLE public.equipe
  ADD COLUMN IF NOT EXISTS fn TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS qual TEXT DEFAULT 'N2',
  ADD COLUMN IF NOT EXISTS taux_h NUMERIC DEFAULT 35,
  ADD COLUMN IF NOT EXISTS statut_presence TEXT DEFAULT 'present',
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE public.avenants ADD COLUMN IF NOT EXISTS ref TEXT DEFAULT '';

ALTER TABLE public.heures
  ADD COLUMN IF NOT EXISTS panier BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trajet BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS zone INTEGER DEFAULT 1;

-- ─────────────────────────────────────────────
-- NOUVELLES TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.devis (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ref TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  objet TEXT NOT NULL DEFAULT '',
  date DATE,
  validite DATE,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  lots JSONB NOT NULL DEFAULT '[]'::jsonb,
  remise NUMERIC NOT NULL DEFAULT 0,
  tva NUMERIC NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commandes (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chantier_id BIGINT NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  ref TEXT NOT NULL DEFAULT '',
  fournisseur TEXT NOT NULL DEFAULT '',
  objet TEXT NOT NULL DEFAULT '',
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'attente',
  date DATE,
  livraison DATE,
  valide_par TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incidents (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chantier_id BIGINT NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  ref TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'autre',
  description TEXT NOT NULL DEFAULT '',
  priorite INTEGER NOT NULL DEFAULT 2,
  statut TEXT NOT NULL DEFAULT 'ouvert',
  signale_par TEXT DEFAULT '',
  date TEXT DEFAULT '',
  screen TEXT DEFAULT 'home',
  bloquant BOOLEAN DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  tel TEXT DEFAULT '',
  email TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'prospect',
  ca NUMERIC NOT NULL DEFAULT 0,
  nb_chantiers INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.situations (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chantier_id BIGINT NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  ref TEXT NOT NULL DEFAULT '',
  num INTEGER NOT NULL DEFAULT 1,
  titre TEXT NOT NULL DEFAULT '',
  avancement INTEGER NOT NULL DEFAULT 0,
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'emise',
  date DATE,
  echeance DATE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planning_equipe (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  membre_id BIGINT REFERENCES public.equipe(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  sem JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conges (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'conge',
  debut TEXT DEFAULT '',
  fin TEXT DEFAULT '',
  jours INTEGER NOT NULL DEFAULT 1,
  statut TEXT NOT NULL DEFAULT 'attente',
  motif TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agenda (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chantier_id BIGINT REFERENCES public.chantiers(id) ON DELETE SET NULL,
  date TEXT DEFAULT '',
  heure TEXT DEFAULT '',
  titre TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'reunion',
  duree INTEGER NOT NULL DEFAULT 60,
  lieu TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes_chantier (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chantier_id BIGINT NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  auteur TEXT NOT NULL DEFAULT '',
  txt TEXT NOT NULL DEFAULT '',
  ts BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  date TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fournisseurs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  tel TEXT DEFAULT '',
  cat TEXT NOT NULL DEFAULT 'materiaux',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devis_org ON public.devis(org_id);
CREATE INDEX IF NOT EXISTS idx_commandes_org_ch ON public.commandes(org_id, chantier_id);
CREATE INDEX IF NOT EXISTS idx_incidents_org_ch ON public.incidents(org_id, chantier_id);
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_situations_org_ch ON public.situations(org_id, chantier_id);
CREATE INDEX IF NOT EXISTS idx_agenda_org ON public.agenda(org_id);
CREATE INDEX IF NOT EXISTS idx_notes_org_ch ON public.notes_chantier(org_id, chantier_id);
CREATE INDEX IF NOT EXISTS idx_fournisseurs_org ON public.fournisseurs(org_id);

-- ─────────────────────────────────────────────
-- FONCTIONS RLS (SECURITY DEFINER)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.be_profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.be_profile_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT org_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.be_profile_chantier_ids()
RETURNS INTEGER[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(chantier_ids, '{}'::integer[]) FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.be_can_access_chantier(cid BIGINT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR cid = ANY(COALESCE(p.chantier_ids, '{}'::integer[]))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.be_same_org(oid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT oid IS NOT NULL AND oid = public.be_profile_org_id() $$;

-- ─────────────────────────────────────────────
-- RLS : retirer politiques ouvertes + appliquer SaaS
-- ─────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'chantiers','taches','factures','messages','avenants',
    'heures','punchlist','rapports','equipe',
    'devis','commandes','incidents','clients','situations',
    'planning_equipe','conges','agenda','notes_chantier','fournisseurs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "saas_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "saas_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "saas_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "saas_delete" ON public.%I', t);
  END LOOP;
END $$;

-- Chantiers : admin voit tout l'org, autres voient leurs chantiers assignés
CREATE POLICY saas_select ON public.chantiers FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_can_access_chantier(id));
CREATE POLICY saas_insert ON public.chantiers FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin', 'chef'));
CREATE POLICY saas_update ON public.chantiers FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_can_access_chantier(id))
  WITH CHECK (public.be_same_org(org_id));
CREATE POLICY saas_delete ON public.chantiers FOR DELETE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin');

-- Tables liées à chantier_id
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'taches','factures','messages','avenants','heures','punchlist','rapports',
    'commandes','incidents','situations','notes_chantier'
  ]
  LOOP
    EXECUTE format($pol$
      CREATE POLICY saas_select ON public.%1$I FOR SELECT TO authenticated
        USING (public.be_same_org(org_id) AND public.be_can_access_chantier(chantier_id));
      CREATE POLICY saas_insert ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (public.be_same_org(org_id) AND public.be_can_access_chantier(chantier_id));
      CREATE POLICY saas_update ON public.%1$I FOR UPDATE TO authenticated
        USING (public.be_same_org(org_id) AND public.be_can_access_chantier(chantier_id))
        WITH CHECK (public.be_same_org(org_id));
      CREATE POLICY saas_delete ON public.%1$I FOR DELETE TO authenticated
        USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
    $pol$, t);
  END LOOP;
END $$;

-- Agenda : chantier optionnel
CREATE POLICY saas_select ON public.agenda FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND (chantier_id IS NULL OR public.be_can_access_chantier(chantier_id)));
CREATE POLICY saas_insert ON public.agenda FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id));
CREATE POLICY saas_update ON public.agenda FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id)) WITH CHECK (public.be_same_org(org_id));
CREATE POLICY saas_delete ON public.agenda FOR DELETE TO authenticated
  USING (public.be_same_org(org_id));

-- Tables org-scoped sans chantier obligatoire
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['devis','clients','conges','fournisseurs','planning_equipe','equipe']
  LOOP
    EXECUTE format($pol$
      CREATE POLICY saas_select ON public.%1$I FOR SELECT TO authenticated
        USING (public.be_same_org(org_id));
      CREATE POLICY saas_insert ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (public.be_same_org(org_id));
      CREATE POLICY saas_update ON public.%1$I FOR UPDATE TO authenticated
        USING (public.be_same_org(org_id)) WITH CHECK (public.be_same_org(org_id));
      CREATE POLICY saas_delete ON public.%1$I FOR DELETE TO authenticated
        USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
    $pol$, t);
  END LOOP;
END $$;

-- Organizations : lecture de sa propre org
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations FOR SELECT TO authenticated
  USING (id = public.be_profile_org_id());

-- Profiles : voir collègues même org (admin/chef)
DROP POLICY IF EXISTS profiles_select_org ON public.profiles;
CREATE POLICY profiles_select_org ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (org_id IS NOT NULL AND org_id = public.be_profile_org_id() AND public.be_profile_role() IN ('admin','chef')));

-- ─────────────────────────────────────────────
-- Auto-provisionnement org à l'inscription
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_user_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_org_id UUID;
BEGIN
  IF NEW.org_id IS NULL THEN
    INSERT INTO public.organizations (nom, plan_id)
    VALUES (COALESCE(NULLIF(NEW.nom, ''), 'Mon entreprise'), 'starter')
    RETURNING id INTO new_org_id;
    NEW.org_id := new_org_id;
    NEW.plan_id := COALESCE(NEW.plan_id, 'starter');
    IF NEW.role IS NULL OR NEW.role = '' THEN
      NEW.role := 'admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_org ON public.profiles;
CREATE TRIGGER profiles_ensure_org
  BEFORE INSERT OR UPDATE OF org_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.org_id IS NULL)
  EXECUTE FUNCTION public.ensure_user_org();
