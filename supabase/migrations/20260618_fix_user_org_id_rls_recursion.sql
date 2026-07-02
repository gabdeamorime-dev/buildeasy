-- Fix infinite RLS recursion on profiles (stack depth limit exceeded)
-- user_org_id() queried profiles without bypassing RLS.

CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_org_id() TO authenticated, service_role;

DROP POLICY IF EXISTS profiles_select_org ON public.profiles;
CREATE POLICY profiles_select_org ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      org_id IS NOT NULL
      AND org_id = public.user_org_id()
      AND public.be_profile_role() IN ('admin', 'chef')
    )
  );
