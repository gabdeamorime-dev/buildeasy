-- BuildEasy — Verrouillage sécurité final (RLS, anon, finances, org)

-- ── Supprimer politiques dangereuses héritées ───────────────────
DO $$
DECLARE
  t TEXT;
  pol RECORD;
  tables TEXT[] := ARRAY[
    'organizations','profiles','chantiers','taches','factures','messages','avenants',
    'heures','punchlist','rapports','commandes','incidents','clients','devis',
    'situations','conges','agenda','equipe','planning_equipe','fournisseurs',
    'notes_chantier','billing_subscriptions','org_invitations','referral_codes',
    'referrals'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_delete" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "org_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "org_update_own" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "profiles_update_self" ON public.%I', t);
  END LOOP;

  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'auth_%'
      AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── Anon : pas d'accès direct aux tables métier ─────────────────
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon;

-- ── Organizations : lecture seule côté client ─────────────────────
DROP POLICY IF EXISTS "org_update_own" ON public.organizations;
DROP POLICY IF EXISTS org_update_own ON public.organizations;

-- ── Factures & situations : écriture gérant uniquement ──────────
DO $$
BEGIN
  IF to_regclass('public.factures') IS NOT NULL THEN
    ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS chantier_id BIGINT;
    ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS org_id UUID;

    DROP POLICY IF EXISTS saas_insert ON public.factures;
    DROP POLICY IF EXISTS saas_update ON public.factures;
    DROP POLICY IF EXISTS saas_delete ON public.factures;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'factures' AND column_name = 'chantier_id'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY saas_insert ON public.factures FOR INSERT TO authenticated
          WITH CHECK (
            public.be_same_org(org_id)
            AND (chantier_id IS NULL OR public.be_can_access_chantier(chantier_id))
            AND public.be_profile_role() = 'admin'
          )
      $pol$;
      EXECUTE $pol$
        CREATE POLICY saas_update ON public.factures FOR UPDATE TO authenticated
          USING (
            public.be_same_org(org_id)
            AND (chantier_id IS NULL OR public.be_can_access_chantier(chantier_id))
            AND public.be_profile_role() = 'admin'
          )
          WITH CHECK (public.be_same_org(org_id))
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY saas_insert ON public.factures FOR INSERT TO authenticated
          WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
      $pol$;
      EXECUTE $pol$
        CREATE POLICY saas_update ON public.factures FOR UPDATE TO authenticated
          USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
          WITH CHECK (public.be_same_org(org_id))
      $pol$;
    END IF;

    EXECUTE $pol$
      CREATE POLICY saas_delete ON public.factures FOR DELETE TO authenticated
        USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
    $pol$;
  END IF;

  IF to_regclass('public.situations') IS NOT NULL THEN
    ALTER TABLE public.situations ADD COLUMN IF NOT EXISTS chantier_id BIGINT;
    ALTER TABLE public.situations ADD COLUMN IF NOT EXISTS org_id UUID;

    DROP POLICY IF EXISTS saas_insert ON public.situations;
    DROP POLICY IF EXISTS saas_update ON public.situations;
    DROP POLICY IF EXISTS saas_delete ON public.situations;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'situations' AND column_name = 'chantier_id'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY saas_insert ON public.situations FOR INSERT TO authenticated
          WITH CHECK (
            public.be_same_org(org_id)
            AND public.be_can_access_chantier(chantier_id)
            AND public.be_profile_role() = 'admin'
          )
      $pol$;
      EXECUTE $pol$
        CREATE POLICY saas_update ON public.situations FOR UPDATE TO authenticated
          USING (
            public.be_same_org(org_id)
            AND public.be_can_access_chantier(chantier_id)
            AND public.be_profile_role() = 'admin'
          )
          WITH CHECK (public.be_same_org(org_id))
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY saas_insert ON public.situations FOR INSERT TO authenticated
          WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
      $pol$;
      EXECUTE $pol$
        CREATE POLICY saas_update ON public.situations FOR UPDATE TO authenticated
          USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
          WITH CHECK (public.be_same_org(org_id))
      $pol$;
    END IF;

    EXECUTE $pol$
      CREATE POLICY saas_delete ON public.situations FOR DELETE TO authenticated
        USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
    $pol$;
  END IF;
END $$;

-- ── Invitations : ne pas renvoyer le token brut dans la liste ───
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
      SELECT
        id,
        email,
        role,
        chantier_ids,
        CASE
          WHEN accepted_at IS NULL AND expires_at > now()
          THEN token
          ELSE NULL
        END AS token,
        expires_at,
        accepted_at,
        created_at
      FROM public.org_invitations
      WHERE org_id = oid
      ORDER BY created_at DESC
      LIMIT 50
    ) t
  ), '[]'::JSON);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_org_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_org_invitations() TO authenticated;

-- ── Referral : ré-autoriser membres authentifiés (org check interne) ─
REVOKE EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) TO authenticated;
