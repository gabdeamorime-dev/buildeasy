-- BuildEasy — Mise à jour des profils démo (après création des comptes Auth)
-- Remplacer les emails si besoin. Les chantier_ids correspondent au seed schema.sql.

UPDATE public.profiles p
SET role = 'admin', chantier_ids = '{1,2,3,4,5}',
    org_id = '00000000-0000-0000-0000-000000000001', plan_id = 'pro'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'admin@buildeasy.eu';

UPDATE public.profiles p
SET role = 'chef', chantier_ids = '{1,5}',
    org_id = '00000000-0000-0000-0000-000000000001', plan_id = 'pro'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'chef@buildeasy.eu';

UPDATE public.profiles p
SET role = 'employe', chantier_ids = '{1}',
    org_id = '00000000-0000-0000-0000-000000000001', plan_id = 'pro'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'ali@buildeasy.eu';

UPDATE public.profiles p
SET role = 'client', chantier_ids = '{1}',
    org_id = '00000000-0000-0000-0000-000000000001', plan_id = 'pro'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'client@buildeasy.eu';

UPDATE public.profiles p
SET vierge = true, role = 'admin', chantier_ids = '{}',
    org_id = '00000000-0000-0000-0000-000000000001', plan_id = 'starter'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'demo1@buildeasy.eu';

-- Alternative : lire ch_ids depuis user_metadata à la connexion si profiles.chantier_ids est vide.
-- Dans Authentication → Users → user metadata JSON :
--   {"nom":"Marc Lefebvre","role":"chef","ch_ids":[1,5]}
