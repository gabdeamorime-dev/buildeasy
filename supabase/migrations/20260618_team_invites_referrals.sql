-- BuildEasy — Invitations équipe + parrainage + finish_signup billing

-- ── Tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'chef', 'employe', 'client')),
  chantier_ids INTEGER[] NOT NULL DEFAULT '{}',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_invitations_org_id_idx ON public.org_invitations (org_id);
CREATE INDEX IF NOT EXISTS org_invitations_email_idx ON public.org_invitations (lower(email));

CREATE TABLE IF NOT EXISTS public.referral_codes (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referred_org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- ── Helpers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.org_user_limit(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE COALESCE(o.plan_id, 'starter')
    WHEN 'starter' THEN 5
    WHEN 'pro' THEN 20
    WHEN 'entreprise' THEN 999999
    ELSE 5
  END
  FROM public.organizations o
  WHERE o.id = p_org_id
$$;

CREATE OR REPLACE FUNCTION public.count_org_members(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.profiles WHERE org_id = p_org_id
$$;

CREATE OR REPLACE FUNCTION public.ensure_org_referral_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing TEXT;
  new_code TEXT;
BEGIN
  SELECT code INTO existing FROM public.referral_codes WHERE org_id = p_org_id;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;
  LOOP
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO public.referral_codes (org_id, code) VALUES (p_org_id, new_code);
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- ── Invitation preview (public via RPC) ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT i.email, i.role, i.chantier_ids, i.expires_at, i.accepted_at, o.name AS org_name
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
    'chantier_ids', inv.chantier_ids,
    'expires_at', inv.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO anon, authenticated;

-- ── Create invitation (admin) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_org_invitation(
  p_email TEXT,
  p_role TEXT DEFAULT 'employe',
  p_chantier_ids INTEGER[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  oid UUID;
  lim INTEGER;
  cnt INTEGER;
  tok TEXT;
  inv_id UUID;
  em TEXT := lower(trim(p_email));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT org_id INTO oid FROM public.profiles WHERE id = uid AND role = 'admin';
  IF oid IS NULL THEN
    RAISE EXCEPTION 'Seul un gérant peut inviter';
  END IF;

  IF em = '' OR em NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Email invalide';
  END IF;

  IF p_role NOT IN ('admin', 'chef', 'employe', 'client') THEN
    RAISE EXCEPTION 'Rôle invalide';
  END IF;

  lim := public.org_user_limit(oid);
  cnt := public.count_org_members(oid);
  cnt := cnt + (
    SELECT COUNT(*)::INTEGER FROM public.org_invitations
    WHERE org_id = oid AND accepted_at IS NULL AND expires_at > now()
  );

  IF cnt >= lim THEN
    RAISE EXCEPTION 'Limite utilisateurs atteinte pour votre formule';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.org_invitations
    WHERE org_id = oid AND lower(email) = em AND accepted_at IS NULL AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Une invitation est déjà en attente pour cet email';
  END IF;

  INSERT INTO public.org_invitations (org_id, email, role, chantier_ids, invited_by)
  VALUES (oid, em, p_role, COALESCE(p_chantier_ids, '{}'), uid)
  RETURNING id, token INTO inv_id, tok;

  RETURN json_build_object('id', inv_id, 'token', tok, 'email', em, 'role', p_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_org_invitation(TEXT, TEXT, INTEGER[]) TO authenticated;

-- ── Accept invitation ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_org_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  inv RECORD;
  user_email TEXT;
  existing_org UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;

  SELECT * INTO inv
  FROM public.org_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation introuvable';
  END IF;

  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation déjà utilisée';
  END IF;

  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expirée';
  END IF;

  IF lower(user_email) <> lower(inv.email) THEN
    RAISE EXCEPTION 'Cette invitation est pour %', inv.email;
  END IF;

  SELECT org_id INTO existing_org FROM public.profiles WHERE id = uid;

  IF existing_org IS NOT NULL AND existing_org <> inv.org_id THEN
    RAISE EXCEPTION 'Vous appartenez déjà à une autre entreprise';
  END IF;

  IF existing_org IS NULL THEN
    IF public.count_org_members(inv.org_id) >= public.org_user_limit(inv.org_id) THEN
      RAISE EXCEPTION 'Limite utilisateurs atteinte pour cette entreprise';
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    org_id = inv.org_id,
    role = inv.role,
    chantier_ids = inv.chantier_ids,
    vierge = false,
    email = COALESCE(email, user_email),
    updated_at = now()
  WHERE id = uid;

  UPDATE public.org_invitations
  SET accepted_at = now(), accepted_by = uid
  WHERE id = inv.id;

  RETURN inv.org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_org_invitation(TEXT) TO authenticated;

-- ── List invitations (admin) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_org_invitations()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oid UUID;
BEGIN
  SELECT org_id INTO oid FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
  IF oid IS NULL THEN
    RETURN '[]'::JSON;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
    FROM (
      SELECT id, email, role, chantier_ids, token, expires_at, accepted_at, created_at
      FROM public.org_invitations
      WHERE org_id = oid
      ORDER BY created_at DESC
      LIMIT 50
    ) t
  ), '[]'::JSON);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_org_invitations() TO authenticated;

-- ── List org members (admin) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_org_members()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oid UUID;
BEGIN
  SELECT org_id INTO oid FROM public.profiles WHERE id = auth.uid() AND role = 'admin';
  IF oid IS NULL THEN
    RETURN '[]'::JSON;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(row_to_json(t) ORDER BY t.nom)
    FROM (
      SELECT id, nom, email, role, chantier_ids, created_at
      FROM public.profiles
      WHERE org_id = oid
      ORDER BY nom
    ) t
  ), '[]'::JSON);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_org_members() TO authenticated;

-- ── Referral info (admin) ───────────────────────────────────────

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
      SELECT json_agg(json_build_object('org_id', r.referred_org_id, 'status', r.status, 'created_at', r.created_at))
      FROM public.referrals r
      WHERE r.referrer_org_id = oid
      ORDER BY r.created_at DESC
      LIMIT 20
    ), '[]'::JSON)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_info() TO authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) TO authenticated;

-- ── RLS ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS org_invitations_admin ON public.org_invitations;
CREATE POLICY org_invitations_admin ON public.org_invitations
  FOR ALL TO authenticated
  USING (org_id = public.be_profile_org_id() AND public.be_profile_role() = 'admin')
  WITH CHECK (org_id = public.be_profile_org_id() AND public.be_profile_role() = 'admin');

DROP POLICY IF EXISTS referral_codes_admin ON public.referral_codes;
CREATE POLICY referral_codes_admin ON public.referral_codes
  FOR SELECT TO authenticated
  USING (org_id = public.be_profile_org_id() AND public.be_profile_role() = 'admin');

DROP POLICY IF EXISTS referrals_admin ON public.referrals;
CREATE POLICY referrals_admin ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_org_id = public.be_profile_org_id() AND public.be_profile_role() = 'admin');

-- ── finish_signup: billing + referral code + record referral ────

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
    INSERT INTO public.organizations (name, plan_id)
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
    SET name = ent
    WHERE id = oid AND name = 'Mon entreprise' AND ent <> 'Mon entreprise';
  END IF;

  RETURN oid;
END;
$$;
