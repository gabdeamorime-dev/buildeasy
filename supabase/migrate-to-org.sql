-- Migration user_id → org_id (multi-tenant SaaS)
-- Exécuter une fois sur le projet Supabase

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chantiers','taches','factures','messages','avenants',
    'heures','punchlist','rapports','equipe',
    'devis','commandes','incidents','clients','situations',
    'conges','agenda'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE',
      t
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_org ON public.%I(org_id)', t, t);
  END LOOP;
END $$;

-- Colonnes UI manquantes
ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS rdv TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS taux_h NUMERIC DEFAULT 35;

ALTER TABLE public.equipe
  ADD COLUMN IF NOT EXISTS fn TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS qual TEXT DEFAULT 'N2',
  ADD COLUMN IF NOT EXISTS taux_h NUMERIC DEFAULT 35,
  ADD COLUMN IF NOT EXISTS statut_presence TEXT DEFAULT 'present';

-- Backfill org_id depuis profiles via user_id (text → uuid)
UPDATE public.chantiers c
SET org_id = p.org_id
FROM public.profiles p
WHERE c.org_id IS NULL AND c.user_id IS NOT NULL AND p.id::text = c.user_id;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['taches','factures','equipe','devis','commandes','incidents','clients','situations','conges','agenda','heures']
  LOOP
    EXECUTE format($q$
      UPDATE public.%1$I x SET org_id = p.org_id
      FROM public.profiles p
      WHERE x.org_id IS NULL AND x.user_id IS NOT NULL AND p.id::text = x.user_id
    $q$, t);
  END LOOP;
END $$;

-- Tables liées chantier : org_id via chantiers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages','avenants','punchlist','rapports','taches','factures','heures','commandes','incidents','situations','notes_chantier']
  LOOP
    EXECUTE format($q$
      UPDATE public.%1$I x SET org_id = c.org_id
      FROM public.chantiers c
      WHERE x.org_id IS NULL AND x.chantier_id = c.id AND c.org_id IS NOT NULL
    $q$, t);
  END LOOP;
END $$;
