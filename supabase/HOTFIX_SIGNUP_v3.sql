-- BuildEasy HOTFIX v3 — inscription + essai 15 jours + billing
-- Supabase Dashboard → SQL Editor → coller TOUT → Run
-- https://supabase.com/dashboard/project/nvgemgfeaxqocrmzdmzy/sql/new

-- ── 1) organizations.name → nom ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'nom'
  ) THEN
    ALTER TABLE public.organizations RENAME COLUMN name TO nom;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'nom'
  ) THEN
    UPDATE public.organizations SET nom = COALESCE(NULLIF(trim(nom), ''), name) WHERE name IS NOT NULL;
    ALTER TABLE public.organizations DROP COLUMN name;
  END IF;
END $$;

-- ── 2) profiles : chantier_ids, org_id nullable ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'ch_ids'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'chantier_ids'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN ch_ids TO chantier_ids;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS vierge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS chantier_ids INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.profiles ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- ── 3) billing_subscriptions (si absente) ───────────────────────
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

-- ── 4) Triggers conflictuels ────────────────────────────────────
DROP TRIGGER IF EXISTS profiles_ensure_org ON public.profiles;
DROP FUNCTION IF EXISTS public.ensure_user_org();

-- ── 5) Trigger inscription ──────────────────────────────────────
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
    COALESCE(NEW.email, ''),
    CASE WHEN is_signup THEN true ELSE COALESCE((NEW.raw_user_meta_data->>'vierge')::boolean, false) END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
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
GRANT ALL ON TABLE public.organizations TO supabase_auth_admin;
GRANT ALL ON TABLE public.billing_subscriptions TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- ── 6) finish_signup + essai 15 jours ───────────────────────────
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
  trial_end TIMESTAMPTZ := now() + interval '15 days';
  ref_code TEXT;
  referrer_oid UUID;
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
    SET org_id = oid,
        nom = CASE WHEN usr_nom <> '' THEN usr_nom ELSE nom END,
        role = 'admin',
        plan_id = 'starter',
        vierge = true,
        email = COALESCE(NULLIF(email, ''), (SELECT email FROM auth.users WHERE id = uid)),
        updated_at = now()
    WHERE id = uid;

    INSERT INTO public.billing_subscriptions (org_id, plan_id, status, current_period_end)
    VALUES (oid, 'starter', 'trialing', trial_end)
    ON CONFLICT (org_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = EXCLUDED.status,
      current_period_end = COALESCE(public.billing_subscriptions.current_period_end, EXCLUDED.current_period_end),
      updated_at = now();

    IF to_regprocedure('public.ensure_org_referral_code(uuid)') IS NOT NULL THEN
      PERFORM public.ensure_org_referral_code(oid);
    END IF;

    ref_code := upper(trim(COALESCE(
      (SELECT raw_user_meta_data->>'ref' FROM auth.users WHERE id = uid),
      ''
    )));

    IF ref_code <> '' AND to_regclass('public.referral_codes') IS NOT NULL THEN
      SELECT rc.org_id INTO referrer_oid
      FROM public.referral_codes rc
      WHERE rc.code = ref_code AND rc.org_id <> oid
      LIMIT 1;

      IF referrer_oid IS NOT NULL AND to_regclass('public.referrals') IS NOT NULL THEN
        INSERT INTO public.referrals (referrer_org_id, referred_org_id, code)
        VALUES (referrer_oid, oid, ref_code)
        ON CONFLICT (referred_org_id) DO NOTHING;

        UPDATE public.referral_codes
        SET uses_count = uses_count + 1
        WHERE code = ref_code;
      END IF;
    END IF;
  ELSE
    UPDATE public.organizations
    SET nom = ent
    WHERE id = oid AND nom = 'Mon entreprise' AND ent <> 'Mon entreprise';
  END IF;

  RETURN oid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finish_signup(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_signup(text, text) TO authenticated;
