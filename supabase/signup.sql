-- BuildEasy — Inscription SaaS (org + profil admin)
-- Exécuter après auth.sql et saas.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chantier_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Tables manquantes (si pas encore créées)
CREATE TABLE IF NOT EXISTS public.notes_chantier (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chantier_id BIGINT NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  auteur TEXT NOT NULL DEFAULT '',
  txt TEXT NOT NULL DEFAULT '',
  ts BIGINT NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS public.planning_equipe (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  membre_id BIGINT,
  nom TEXT NOT NULL DEFAULT '',
  sem JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger inscription : profil initial (compatible Auth Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_signup BOOLEAN := COALESCE(NEW.raw_user_meta_data->>'signup', '') IN ('true', 't', '1');
  user_nom TEXT := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nom'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Utilisateur'
  );
  user_role TEXT := CASE
    WHEN is_signup THEN 'admin'
    ELSE COALESCE(NULLIF(NEW.raw_app_meta_data->>'role', ''), 'employe')
  END;
BEGIN
  INSERT INTO public.profiles (id, nom, role, chantier_ids, email, vierge)
  VALUES (
    NEW.id,
    user_nom,
    user_role,
    '{}'::integer[],
    NEW.email,
    CASE WHEN is_signup THEN true ELSE COALESCE((NEW.raw_user_meta_data->>'vierge')::boolean, false) END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    nom = CASE WHEN public.profiles.nom = '' OR public.profiles.nom IS NULL THEN EXCLUDED.nom ELSE public.profiles.nom END,
    updated_at = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- Finalise l'org après signup (idempotent)
CREATE OR REPLACE FUNCTION public.finish_signup(entreprise_nom text, nom_utilisateur text)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  oid UUID;
  ent TEXT := COALESCE(NULLIF(trim(entreprise_nom), ''), 'Mon entreprise');
  usr_nom TEXT := COALESCE(NULLIF(trim(nom_utilisateur), ''), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT org_id INTO oid FROM public.profiles WHERE id = uid;

  IF oid IS NULL THEN
    INSERT INTO public.organizations (nom, plan_id)
    VALUES (ent, 'starter')
    RETURNING id INTO oid;

    UPDATE public.profiles
    SET
      org_id = oid,
      nom = CASE WHEN usr_nom <> '' THEN usr_nom ELSE nom END,
      role = 'admin',
      plan_id = 'starter',
      vierge = true,
      email = COALESCE(email, (SELECT email FROM auth.users WHERE id = uid)),
      updated_at = now()
    WHERE id = uid;

    INSERT INTO public.billing_subscriptions (org_id, plan_id, status)
    VALUES (oid, 'starter', 'trialing')
    ON CONFLICT (org_id) DO NOTHING;
  ELSE
    UPDATE public.organizations
    SET nom = ent
    WHERE id = oid AND nom = 'Mon entreprise' AND ent <> 'Mon entreprise';
  END IF;

  RETURN oid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_signup(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.finish_signup(text, text) FROM PUBLIC;

-- Billing Stripe (préparation)
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT NOT NULL DEFAULT 'starter' CHECK (plan_id IN ('starter', 'pro', 'entreprise')),
  status TEXT NOT NULL DEFAULT 'trialing',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_select ON public.billing_subscriptions;
CREATE POLICY billing_select ON public.billing_subscriptions
  FOR SELECT TO authenticated
  USING (org_id = public.be_profile_org_id());

-- Désactive l'auto-org sur trigger (géré par finish_signup)
DROP TRIGGER IF EXISTS profiles_ensure_org ON public.profiles;
DROP FUNCTION IF EXISTS public.ensure_user_org();

-- Grants Data API
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
