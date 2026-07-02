-- Durcissement équipe / parrainage / usage org

-- ── Usage stats (jauge abonnement) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_usage_stats()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oid UUID;
  members INTEGER;
  pending INTEGER;
  lim INTEGER;
BEGIN
  SELECT org_id INTO oid FROM public.profiles WHERE id = auth.uid();
  IF oid IS NULL THEN
    RETURN json_build_object('members', 0, 'pending_invites', 0, 'limit', 5);
  END IF;
  members := public.count_org_members(oid);
  SELECT COUNT(*)::INTEGER INTO pending
  FROM public.org_invitations
  WHERE org_id = oid AND accepted_at IS NULL AND expires_at > now();
  lim := public.org_user_limit(oid);
  RETURN json_build_object('members', members, 'pending_invites', pending, 'limit', lim);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_usage_stats() TO authenticated;

-- ── Referral info enrichi ────────────────────────────────────────

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
        'org_name', o.name,
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

-- ── Accept invitation + sync equipe métier ───────────────────────

CREATE OR REPLACE FUNCTION public.accept_org_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  inv RECORD;
  user_email TEXT;
  user_nom TEXT;
  existing_org UUID;
  role_label TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'nom', split_part(email, '@', 1))
  INTO user_email, user_nom
  FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.org_invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation déjà utilisée'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expirée'; END IF;
  IF lower(user_email) <> lower(inv.email) THEN RAISE EXCEPTION 'Cette invitation est pour %', inv.email; END IF;

  SELECT org_id INTO existing_org FROM public.profiles WHERE id = uid;
  IF existing_org IS NOT NULL AND existing_org <> inv.org_id THEN
    RAISE EXCEPTION 'Vous appartenez déjà à une autre entreprise';
  END IF;
  IF existing_org IS NULL AND public.count_org_members(inv.org_id) >= public.org_user_limit(inv.org_id) THEN
    RAISE EXCEPTION 'Limite utilisateurs atteinte pour cette entreprise';
  END IF;

  UPDATE public.profiles
  SET
    org_id = inv.org_id,
    role = inv.role,
    chantier_ids = inv.chantier_ids,
    vierge = false,
    email = COALESCE(email, user_email),
    nom = COALESCE(NULLIF(trim(nom), ''), user_nom),
    updated_at = now()
  WHERE id = uid;

  UPDATE public.org_invitations SET accepted_at = now(), accepted_by = uid WHERE id = inv.id;

  role_label := CASE inv.role
    WHEN 'admin' THEN 'Gérant'
    WHEN 'chef' THEN 'Chef de chantier'
    WHEN 'client' THEN 'Client MOA'
    ELSE 'Compagnon'
  END;

  IF EXISTS (
    SELECT 1 FROM public.equipe e
    WHERE e.org_id = inv.org_id AND e.user_id = uid::text
  ) THEN
    UPDATE public.equipe
    SET nom = user_nom, fn = role_label, email = user_email, role = inv.role,
        chids = to_jsonb(inv.chantier_ids), statut_presence = COALESCE(statut_presence, 'present')
    WHERE org_id = inv.org_id AND user_id = uid::text;
  ELSE
    INSERT INTO public.equipe (org_id, user_id, nom, fn, email, role, chids, statut_presence, taux_h, qual, statut)
    VALUES (
      inv.org_id, uid::text, user_nom, role_label, user_email, inv.role,
      to_jsonb(inv.chantier_ids), 'present', 35, 'N2', 'actif'
    );
  END IF;

  RETURN inv.org_id;
END;
$$;

-- ── list_org_members : admin + chef ──────────────────────────────

CREATE OR REPLACE FUNCTION public.list_org_members()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  oid UUID;
  my_role TEXT;
BEGIN
  SELECT org_id, role INTO oid, my_role FROM public.profiles WHERE id = auth.uid();
  IF oid IS NULL OR my_role NOT IN ('admin', 'chef') THEN
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
