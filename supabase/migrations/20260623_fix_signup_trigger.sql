-- Fix inscription : trigger handle_new_user + colonne organizations.nom (pas name)

-- ── Colonne organizations : nom est le canonique ────────────────
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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS vierge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS chantier_ids INTEGER[] NOT NULL DEFAULT '{}';

-- Conflit avec finish_signup : pas d'auto-org au INSERT profil
DROP TRIGGER IF EXISTS profiles_ensure_org ON public.profiles;
DROP FUNCTION IF EXISTS public.ensure_user_org();

-- Trigger inscription auth.users
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

-- Droits pour le trigger Auth Supabase
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- finish_signup : utiliser nom (pas name)
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

    PERFORM public.ensure_org_referral_code(oid);

    ref_code := upper(trim(COALESCE(
      (SELECT raw_user_meta_data->>'ref' FROM auth.users WHERE id = uid),
      ''
    )));

    IF ref_code <> '' THEN
      SELECT rc.org_id INTO referrer_oid
      FROM public.referral_codes rc
      WHERE rc.code = ref_code AND rc.org_id <> oid
      LIMIT 1;

      IF referrer_oid IS NOT NULL THEN
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

-- RPC qui référençaient organizations.name
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT i.email, i.role, i.chantier_ids, i.expires_at, i.accepted_at, o.nom AS org_name
  INTO inv
  FROM public.org_invitations i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invitation introuvable');
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invitation déjà utilisée');
  END IF;

  IF inv.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', 'Invitation expirée');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'email', inv.email,
    'role', inv.role,
    'org_name', inv.org_name,
    'chantier_ids', inv.chantier_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_referral_info()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oid UUID;
  code TEXT;
  nb INTEGER;
BEGIN
  SELECT org_id INTO oid FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
  IF oid IS NULL THEN
    RETURN json_build_object('code', null, 'uses_count', 0, 'referrals', '[]'::JSON);
  END IF;

  code := public.ensure_org_referral_code(oid);
  SELECT uses_count INTO nb FROM public.referral_codes WHERE org_id = oid;

  RETURN json_build_object(
    'code', code,
    'uses_count', COALESCE(nb, 0),
    'referrals', COALESCE((
      SELECT json_agg(json_build_object(
        'org_id', r.referred_org_id,
        'org_name', o.nom,
        'status', r.status,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.referrals r
      JOIN public.organizations o ON o.id = r.referred_org_id
      WHERE r.referrer_org_id = oid
      LIMIT 20
    ), '[]'::JSON)
  );
END;
$$;
