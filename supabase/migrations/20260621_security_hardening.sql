-- BuildEasy — Durcissement sécurité (RLS rôles, limites plan, referral, messages)

-- ── Referral : uniquement sa propre org ─────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_org_referral_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  existing TEXT;
  new_code TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.be_same_org(p_org_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_org_referral_code(UUID) FROM authenticated;

-- ── Profils : empêcher élévation de privilèges ─────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND org_id IS NOT DISTINCT FROM (SELECT p.org_id FROM public.profiles p WHERE p.id = auth.uid())
    AND plan_id IS NOT DISTINCT FROM (SELECT p.plan_id FROM public.profiles p WHERE p.id = auth.uid())
    AND chantier_ids IS NOT DISTINCT FROM (SELECT p.chantier_ids FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ── Limite chantiers par plan (serveur) ─────────────────────────
CREATE OR REPLACE FUNCTION public.be_org_chantier_limit(p_org_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE COALESCE(o.plan_id, 'starter')
    WHEN 'starter' THEN 3
    ELSE 2147483647
  END
  FROM public.organizations o
  WHERE o.id = p_org_id
$$;

CREATE OR REPLACE FUNCTION public.be_enforce_chantier_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  lim INTEGER;
  cnt INTEGER;
BEGIN
  SELECT public.be_org_chantier_limit(NEW.org_id) INTO lim;
  SELECT COUNT(*)::INTEGER FROM public.chantiers WHERE org_id = NEW.org_id INTO cnt;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'Limite de chantiers atteinte pour votre abonnement (%).', lim;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS be_chantier_limit_trg ON public.chantiers;
CREATE TRIGGER be_chantier_limit_trg
  BEFORE INSERT ON public.chantiers
  FOR EACH ROW EXECUTE FUNCTION public.be_enforce_chantier_limit();

-- ── RLS par rôle (depuis rls-role-hardening.sql) ────────────────

-- Devis & CRM : gérant uniquement
DROP POLICY IF EXISTS saas_select ON public.devis;
DROP POLICY IF EXISTS saas_insert ON public.devis;
DROP POLICY IF EXISTS saas_update ON public.devis;
CREATE POLICY saas_select ON public.devis FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin');
CREATE POLICY saas_insert ON public.devis FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() = 'admin');
CREATE POLICY saas_update ON public.devis FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
  WITH CHECK (public.be_same_org(org_id));

DROP POLICY IF EXISTS saas_select ON public.clients;
DROP POLICY IF EXISTS saas_insert ON public.clients;
DROP POLICY IF EXISTS saas_update ON public.clients;
CREATE POLICY saas_select ON public.clients FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin');
CREATE POLICY saas_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() = 'admin');
CREATE POLICY saas_update ON public.clients FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() = 'admin')
  WITH CHECK (public.be_same_org(org_id));

-- Fournisseurs, équipe, planning
DROP POLICY IF EXISTS saas_select ON public.fournisseurs;
DROP POLICY IF EXISTS saas_insert ON public.fournisseurs;
DROP POLICY IF EXISTS saas_update ON public.fournisseurs;
CREATE POLICY saas_select ON public.fournisseurs FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe'));
CREATE POLICY saas_insert ON public.fournisseurs FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
CREATE POLICY saas_update ON public.fournisseurs FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'))
  WITH CHECK (public.be_same_org(org_id));

DROP POLICY IF EXISTS saas_select ON public.equipe;
DROP POLICY IF EXISTS saas_insert ON public.equipe;
DROP POLICY IF EXISTS saas_update ON public.equipe;
CREATE POLICY saas_select ON public.equipe FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe'));
CREATE POLICY saas_insert ON public.equipe FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
CREATE POLICY saas_update ON public.equipe FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'))
  WITH CHECK (public.be_same_org(org_id));

DROP POLICY IF EXISTS saas_select ON public.planning_equipe;
DROP POLICY IF EXISTS saas_insert ON public.planning_equipe;
DROP POLICY IF EXISTS saas_update ON public.planning_equipe;
CREATE POLICY saas_select ON public.planning_equipe FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe'));
CREATE POLICY saas_insert ON public.planning_equipe FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
CREATE POLICY saas_update ON public.planning_equipe FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'))
  WITH CHECK (public.be_same_org(org_id));

-- Agenda terrain
DROP POLICY IF EXISTS saas_select ON public.agenda;
DROP POLICY IF EXISTS saas_insert ON public.agenda;
DROP POLICY IF EXISTS saas_update ON public.agenda;
DROP POLICY IF EXISTS saas_delete ON public.agenda;
CREATE POLICY saas_select ON public.agenda FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe')
    AND (chantier_id IS NULL OR public.be_can_access_chantier(chantier_id)));
CREATE POLICY saas_insert ON public.agenda FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
CREATE POLICY saas_update ON public.agenda FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'))
  WITH CHECK (public.be_same_org(org_id));
CREATE POLICY saas_delete ON public.agenda FOR DELETE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));

-- Congés
DROP POLICY IF EXISTS saas_select ON public.conges;
DROP POLICY IF EXISTS saas_insert ON public.conges;
DROP POLICY IF EXISTS saas_update ON public.conges;
CREATE POLICY saas_select ON public.conges FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe'));
CREATE POLICY saas_insert ON public.conges FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe'));
CREATE POLICY saas_update ON public.conges FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'))
  WITH CHECK (public.be_same_org(org_id));

-- Messages : pas de publication pour le client MOA
DROP POLICY IF EXISTS saas_insert ON public.messages;
CREATE POLICY saas_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.be_same_org(org_id)
    AND public.be_can_access_chantier(chantier_id)
    AND public.be_profile_role() IN ('admin', 'chef', 'employe')
  );

-- Factures : finances admin + client MOA uniquement
DROP POLICY IF EXISTS saas_select ON public.factures;
CREATE POLICY saas_select ON public.factures FOR SELECT TO authenticated
  USING (
    public.be_same_org(org_id)
    AND public.be_can_access_chantier(chantier_id)
    AND public.be_profile_role() IN ('admin', 'client')
  );

-- Situations : idem factures
DROP POLICY IF EXISTS saas_select ON public.situations;
CREATE POLICY saas_select ON public.situations FOR SELECT TO authenticated
  USING (
    public.be_same_org(org_id)
    AND public.be_can_access_chantier(chantier_id)
    AND public.be_profile_role() IN ('admin', 'client')
  );
