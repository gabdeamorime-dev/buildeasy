-- BuildEasy — Renforcement RLS par rôle (à exécuter après saas.sql)
-- Gérant (admin) · Chef · Compagnon (employe) · Client MOA (client)

-- Devis & CRM : réservés au gérant
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

-- Fournisseurs, équipe, planning : terrain (pas le client MOA)
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

-- Agenda : équipe terrain uniquement
DROP POLICY IF EXISTS saas_select ON public.agenda;
DROP POLICY IF EXISTS saas_insert ON public.agenda;
DROP POLICY IF EXISTS saas_update ON public.agenda;
CREATE POLICY saas_select ON public.agenda FOR SELECT TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef','employe')
    AND (chantier_id IS NULL OR public.be_can_access_chantier(chantier_id)));
CREATE POLICY saas_insert ON public.agenda FOR INSERT TO authenticated
  WITH CHECK (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'));
CREATE POLICY saas_update ON public.agenda FOR UPDATE TO authenticated
  USING (public.be_same_org(org_id) AND public.be_profile_role() IN ('admin','chef'))
  WITH CHECK (public.be_same_org(org_id));

-- Congés : lecture org, validation admin/chef
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
