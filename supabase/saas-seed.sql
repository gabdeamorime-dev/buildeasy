-- BuildEasy SaaS — Seed organisation démo + rattachement données existantes
-- Prérequis : schema.sql + auth.sql + saas.sql + comptes Auth créés

INSERT INTO public.organizations (id, nom, plan_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'BuildEasy Démo', 'pro')
ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom, plan_id = EXCLUDED.plan_id;

-- Profils démo → org
UPDATE public.profiles
SET org_id = '00000000-0000-0000-0000-000000000001',
    plan_id = 'pro',
    email = u.email
FROM auth.users u
WHERE profiles.id = u.id
  AND u.email IN (
    'admin@buildeasy.eu', 'chef@buildeasy.eu',
    'ali@buildeasy.eu', 'client@buildeasy.eu', 'demo1@buildeasy.eu'
  );

UPDATE public.profiles SET vierge = true
FROM auth.users u
WHERE profiles.id = u.id AND u.email = 'demo1@buildeasy.eu';

-- Données MVP existantes → org
UPDATE public.chantiers SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.taches SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.factures SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.messages SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.avenants SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.heures SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.punchlist SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.rapports SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.equipe SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Fournisseurs démo
INSERT INTO public.fournisseurs (org_id, nom, tel, cat, url) VALUES
('00000000-0000-0000-0000-000000000001','Point P','3616','materiaux','https://www.pointp.fr'),
('00000000-0000-0000-0000-000000000001','Cedeo','3633','plomberie','https://www.cedeo.fr'),
('00000000-0000-0000-0000-000000000001','Weber','01 41 85 25 25','enduits','https://www.weber.fr'),
('00000000-0000-0000-0000-000000000001','BigMat','0811 888 111','materiaux','https://www.bigmat.fr'),
('00000000-0000-0000-0000-000000000001','Rexel','0800 600 700','electricite','https://www.rexel.fr'),
('00000000-0000-0000-0000-000000000001','Kiloutou','3645','location','https://www.kiloutou.fr'),
('00000000-0000-0000-0000-000000000001','Loxam','0811 105 500','location','https://www.loxam.fr')
ON CONFLICT DO NOTHING;

-- Clients démo
INSERT INTO public.clients (org_id, nom, tel, email, adresse, statut, ca, nb_chantiers, note) VALUES
('00000000-0000-0000-0000-000000000001','M. Dupont','06 11 22 33 44','dupont@mail.fr','12 rue des Roses, Paris 16e','client',85000,1,'Client fidèle'),
('00000000-0000-0000-0000-000000000001','Mme Martin','06 22 33 44 55','martin@mail.fr','8 allée des Pins, Versailles','client',120000,1,''),
('00000000-0000-0000-0000-000000000001','M. Morel','06 66 77 88 99','morel@mail.fr','15 rue Victor Hugo, Créteil','prospect',0,0,'Veut devis SDB')
ON CONFLICT DO NOTHING;
