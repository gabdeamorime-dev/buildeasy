-- BuildEasy — Auth & profils
-- Prérequis : activer Email/Password dans Authentication → Providers
-- Pour le dev : désactiver "Confirm email" dans Authentication → Providers → Email

-- ─────────────────────────────────────────────
-- TABLE PROFILES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employe' CHECK (role IN ('admin', 'chef', 'employe', 'client')),
  chantier_ids INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ─────────────────────────────────────────────
-- TRIGGER : profil vide à l'inscription
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Role from app_metadata only (service role / admin API). Never user_metadata.
  INSERT INTO public.profiles (id, nom, role, chantier_ids)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_app_meta_data->>'role', ''), 'employe'),
    '{}'::integer[]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- RLS PROFILES
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

-- ─────────────────────────────────────────────
-- RLS DONNÉES MÉTIER : utilisateurs connectés uniquement
-- ─────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chantiers', 'taches', 'factures', 'messages', 'avenants',
    'heures', 'punchlist', 'rapports', 'equipe'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_anon_delete" ON %I', t);

    EXECUTE format('DROP POLICY IF EXISTS "auth_select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete" ON %I', t);

    EXECUTE format(
      'CREATE POLICY "auth_select" ON %I FOR SELECT TO authenticated USING (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth_insert" ON %I FOR INSERT TO authenticated WITH CHECK (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth_update" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth_delete" ON %I FOR DELETE TO authenticated USING (true)',
      t
    );
  END LOOP;
END $$;
