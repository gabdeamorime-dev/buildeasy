-- BuildEasy — Schéma Supabase
-- Exécuter dans : Supabase Dashboard → SQL Editor → New query → Run

-- ─────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chantiers (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  tel TEXT DEFAULT '',
  corps TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'en_attente',
  avancement INTEGER NOT NULL DEFAULT 0,
  budget NUMERIC NOT NULL DEFAULT 0,
  depenses NUMERIC NOT NULL DEFAULT 0,
  debut DATE,
  fin DATE,
  equipe JSONB NOT NULL DEFAULT '[]'::jsonb,
  priorite TEXT NOT NULL DEFAULT 'normale',
  note TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  meteo TEXT DEFAULT '📋',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS taches (
  id BIGSERIAL PRIMARY KEY,
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  titre TEXT NOT NULL DEFAULT '',
  responsable TEXT DEFAULT '',
  debut DATE,
  fin DATE,
  statut TEXT NOT NULL DEFAULT 'a_faire',
  duree INTEGER NOT NULL DEFAULT 1,
  priorite TEXT NOT NULL DEFAULT 'normale'
);

CREATE TABLE IF NOT EXISTS factures (
  id TEXT PRIMARY KEY,
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  chantier TEXT DEFAULT '',
  client TEXT DEFAULT '',
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'brouillon',
  date DATE,
  echeance DATE
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  auteur TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT '',
  texte TEXT NOT NULL DEFAULT '',
  heure TEXT DEFAULT '',
  date DATE
);

CREATE TABLE IF NOT EXISTS avenants (
  id BIGSERIAL PRIMARY KEY,
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  titre TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  montant NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_creation DATE,
  date_validation DATE,
  valide_par TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS heures (
  id BIGSERIAL PRIMARY KEY,
  membre_id BIGINT,
  membre_nom TEXT NOT NULL DEFAULT '',
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  arrivee TEXT DEFAULT '',
  depart TEXT DEFAULT '',
  pause_min INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  valide BOOLEAN NOT NULL DEFAULT false,
  validee_par TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS punchlist (
  id BIGSERIAL PRIMARY KEY,
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  titre TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  categorie TEXT DEFAULT 'Autre',
  priorite TEXT NOT NULL DEFAULT 'normale',
  statut TEXT NOT NULL DEFAULT 'ouvert',
  signale_par TEXT DEFAULT '',
  date_signalement DATE,
  date_resolution DATE,
  assigne_a TEXT DEFAULT '',
  photos INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rapports (
  id BIGSERIAL PRIMARY KEY,
  chantier_id BIGINT NOT NULL REFERENCES chantiers(id) ON DELETE CASCADE,
  date DATE,
  auteur TEXT DEFAULT '',
  meteo TEXT DEFAULT '☀️',
  temperature TEXT DEFAULT '',
  avancement TEXT DEFAULT '',
  problemes TEXT DEFAULT 'RAS',
  presences JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipe (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT '',
  tel TEXT DEFAULT '',
  heures INTEGER NOT NULL DEFAULT 0,
  chantiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispo BOOLEAN NOT NULL DEFAULT true
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_taches_chantier ON taches(chantier_id);
CREATE INDEX IF NOT EXISTS idx_messages_chantier ON messages(chantier_id);
CREATE INDEX IF NOT EXISTS idx_heures_date ON heures(date);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE avenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE heures ENABLE ROW LEVEL SECURITY;
ALTER TABLE punchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapports ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe ENABLE ROW LEVEL SECURITY;

-- Politiques MVP : accès via clé anon (auth Supabase à brancher plus tard)
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

    EXECUTE format(
      'CREATE POLICY "allow_anon_select" ON %I FOR SELECT TO anon, authenticated USING (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY "allow_anon_insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY "allow_anon_update" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)',
      t
    );
    EXECUTE format(
      'CREATE POLICY "allow_anon_delete" ON %I FOR DELETE TO anon, authenticated USING (true)',
      t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- DONNÉES DE DÉMO (optionnel)
-- ─────────────────────────────────────────────

-- Réinitialiser les données de démo (décommenter si besoin)
-- TRUNCATE chantiers, taches, factures, messages, avenants, heures, punchlist, rapports, equipe RESTART IDENTITY CASCADE;

INSERT INTO chantiers (id, nom, client, tel, corps, statut, avancement, budget, depenses, debut, fin, equipe, priorite, note, adresse, meteo)
VALUES
  (1, 'Rénovation Villa Dupont', 'M. Dupont', '06 11 22 33 44', 'Maçonnerie + Plomberie', 'en_cours', 68, 85000, 62400, '2026-03-10', '2026-06-30', '["Jean","Marc","Ali"]', 'haute', 'Attention délai façade', '12 rue des Roses, Paris 16e', '☀️'),
  (2, 'Extension Pavillon Martin', 'Mme Martin', '06 22 33 44 55', 'Gros Œuvre', 'en_cours', 34, 120000, 41800, '2026-04-01', '2026-09-15', '["Karim","Sébastien"]', 'normale', '', '8 allée des Pins, Versailles', '🌤️'),
  (3, 'Réfection toiture Leroy', 'M. Leroy', '06 33 44 55 66', 'Couverture', 'termine', 100, 22000, 21340, '2026-01-15', '2026-03-01', '["Pierre","Nicolas"]', 'basse', 'PV signé ✓', '5 rue du Moulin, Lyon 3e', '✅'),
  (4, 'Aménagement cuisine Brun', 'Famille Brun', '06 44 55 66 77', 'Électricité + Plomberie', 'en_attente', 0, 18500, 0, '2026-06-01', '2026-07-15', '[]', 'normale', '', '3 rue Nationale, Bordeaux', '📋'),
  (5, 'Ravalement façade Moreau', 'Synd. Copropriété', '06 55 66 77 88', 'Façade + Peinture', 'en_cours', 52, 56000, 30200, '2026-02-20', '2026-05-31', '["Thomas","Kevin"]', 'haute', 'Réunion copro 25/05', '22 bd Haussmann, Paris 9e', '🌤️')
ON CONFLICT (id) DO NOTHING;

SELECT setval('chantiers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM chantiers));

INSERT INTO taches (id, chantier_id, titre, responsable, debut, fin, statut, duree, priorite) VALUES
  (1, 1, 'Coulage dalle béton', 'Ali', '2026-05-01', '2026-05-08', 'fait', 7, 'haute'),
  (2, 1, 'Installation plomberie sdb', 'Marc', '2026-05-09', '2026-05-18', 'en_cours', 9, 'haute'),
  (3, 1, 'Carrelage sol RDC', 'Ali', '2026-05-15', '2026-05-25', 'a_faire', 10, 'normale'),
  (4, 1, 'Peinture intérieure', 'Marc', '2026-05-20', '2026-06-05', 'a_faire', 16, 'basse'),
  (5, 2, 'Fondations extension', 'Karim', '2026-04-10', '2026-04-20', 'fait', 10, 'haute'),
  (6, 2, 'Élévation murs', 'Sébastien', '2026-04-21', '2026-05-10', 'en_cours', 19, 'haute'),
  (7, 5, 'Préparation supports', 'Thomas', '2026-02-20', '2026-03-05', 'fait', 13, 'normale'),
  (8, 5, 'Peinture finition', 'Kevin', '2026-05-01', '2026-05-31', 'en_cours', 30, 'normale')
ON CONFLICT (id) DO NOTHING;

INSERT INTO factures (id, chantier_id, chantier, client, montant, statut, date, echeance) VALUES
  ('FAC-001', 1, 'Villa Dupont', 'M. Dupont', 28500, 'payee', '2026-03-15', '2026-04-15'),
  ('FAC-002', 2, 'Extension Martin', 'Mme Martin', 40000, 'payee', '2026-04-01', '2026-05-01'),
  ('FAC-003', 5, 'Ravalement Moreau', 'Synd. Copropriété', 18000, 'en_attente', '2026-04-20', '2026-05-20'),
  ('FAC-004', 1, 'Villa Dupont', 'M. Dupont', 22000, 'en_retard', '2026-04-10', '2026-05-10'),
  ('FAC-005', 3, 'Toiture Leroy', 'M. Leroy', 21340, 'payee', '2026-03-05', '2026-04-05')
ON CONFLICT (id) DO NOTHING;

INSERT INTO equipe (id, nom, role, tel, heures, chantiers, dispo) VALUES
  (1, 'Jean Dupont', 'Chef de chantier', '06 12 34 56 78', 142, '[1,2]', true),
  (2, 'Marc Lefebvre', 'Chef de chantier', '06 23 45 67 89', 98, '[1,5]', true),
  (3, 'Ali Benali', 'Maçon', '06 34 56 78 90', 126, '[1]', false),
  (4, 'Karim Diallo', 'Gros Œuvre', '06 45 67 89 01', 110, '[2]', true),
  (5, 'Thomas Bernard', 'Façadier', '06 67 89 01 23', 136, '[5]', true),
  (6, 'Kevin Simon', 'Peintre', '06 89 01 23 45', 92, '[5]', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rapports (id, chantier_id, date, auteur, meteo, temperature, avancement, problemes, presences, photos) VALUES
  (1, 1, '2026-05-16', 'Marc Lefebvre', '☀️', '22°C', 'Coulage dalle terminé. Plomberie en cours section nord.', 'RAS', '["Marc","Ali"]', 3),
  (2, 5, '2026-05-16', 'Thomas Bernard', '🌤️', '18°C', 'Peinture finition 60% zone nord.', 'Manque 2 bidons blanc cassé', '["Thomas","Kevin"]', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, chantier_id, auteur, role, texte, heure, date) VALUES
  (1, 1, 'Marc Lefebvre', 'chef', 'Dalle coulée ce matin, RAS. On attaque la plomberie demain.', '08:32', '2026-05-16'),
  (2, 1, 'Ali Benali', 'employe', 'OK chef. J''ai pris les photos.', '08:45', '2026-05-16'),
  (3, 1, 'Jean Dupont', 'admin', 'Parfait. M. Dupont a demandé une visite vendredi matin.', '09:10', '2026-05-16'),
  (4, 5, 'Thomas Bernard', 'chef', 'Il manque 2 bidons de blanc cassé. Quelqu''un peut passer chez Point P ?', '14:20', '2026-05-16'),
  (5, 5, 'Jean Dupont', 'admin', 'Je commande en ligne, livraison demain matin.', '14:35', '2026-05-16')
ON CONFLICT (id) DO NOTHING;

INSERT INTO avenants (id, chantier_id, titre, description, montant, statut, date_creation, date_validation, valide_par) VALUES
  (1, 1, 'Ajout douche à l''italienne', 'Remplacement baignoire par douche à l''italienne.', 2800, 'accepte', '2026-04-20', '2026-04-22', 'M. Dupont'),
  (2, 1, 'Peinture couloir en plus', 'Peinture couloir d''entrée non prévu initialement.', 650, 'en_attente', '2026-05-10', NULL, '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO punchlist (id, chantier_id, titre, description, categorie, priorite, statut, signale_par, date_signalement, date_resolution, assigne_a, photos) VALUES
  (1, 1, 'Fissure angle mur cuisine', 'Fissure verticale 15cm angle mur/plafond.', 'Maçonnerie', 'haute', 'en_cours', 'Marc Lefebvre', '2026-05-10', NULL, 'Ali Benali', 1),
  (2, 1, 'Carrelage décollé salle de bain', '3 carreaux décollés dans la douche.', 'Carrelage', 'haute', 'ouvert', 'M. Dupont', '2026-05-14', NULL, 'Ali Benali', 2),
  (3, 1, 'Joint silicone baignoire', 'Joint non conforme, discontinuités.', 'Plomberie', 'normale', 'resolu', 'Marc Lefebvre', '2026-05-08', '2026-05-12', 'Marc Lefebvre', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO heures (id, membre_id, membre_nom, chantier_id, date, arrivee, depart, pause_min, description, valide, validee_par) VALUES
  (1, 3, 'Ali Benali', 1, '2026-05-19', '07:30', '17:00', 45, 'Préparation coffrage dalle RDC', true, 'Marc Lefebvre'),
  (2, 2, 'Marc Lefebvre', 1, '2026-05-19', '07:00', '17:30', 60, 'Supervision coffrage + réunion client', true, 'Jean Dupont'),
  (3, 5, 'Thomas Bernard', 5, '2026-05-19', '08:00', '16:00', 45, 'Peinture façade zone nord — 1ère couche', true, 'Marc Lefebvre'),
  (4, 6, 'Kevin Simon', 5, '2026-05-19', '08:30', '16:30', 45, 'Préparation enduit façade est', true, 'Marc Lefebvre'),
  (5, 3, 'Ali Benali', 1, '2026-05-20', '07:30', '17:00', 45, 'Coulage dalle béton RDC', true, 'Marc Lefebvre'),
  (6, 2, 'Marc Lefebvre', 1, '2026-05-20', '07:00', '18:00', 60, 'Contrôle coulage + coordination plomberie', true, 'Jean Dupont'),
  (7, 5, 'Thomas Bernard', 5, '2026-05-20', '08:00', '16:00', 45, 'Peinture façade zone nord — 2ème couche', true, 'Marc Lefebvre'),
  (8, 4, 'Karim Diallo', 2, '2026-05-20', '07:00', '16:00', 45, 'Élévation murs parpaings R+1', true, 'Jean Dupont'),
  (9, 3, 'Ali Benali', 1, '2026-05-21', '07:30', '12:00', 0, 'Décoffrage dalle — demi-journée', true, 'Marc Lefebvre'),
  (10, 2, 'Marc Lefebvre', 1, '2026-05-21', '07:00', '17:00', 60, 'Installation plomberie SDB — secteur nord', true, 'Jean Dupont'),
  (11, 4, 'Karim Diallo', 2, '2026-05-21', '07:00', '16:00', 45, 'Élévation murs + chaînage horizontal', true, 'Jean Dupont'),
  (12, 6, 'Kevin Simon', 5, '2026-05-21', '08:00', '16:30', 45, 'Peinture façade est — finition', false, ''),
  (13, 3, 'Ali Benali', 1, '2026-05-22', '07:30', '17:00', 45, 'Pose carrelage sol RDC — début', false, ''),
  (14, 2, 'Marc Lefebvre', 1, '2026-05-22', '07:00', '17:00', 60, 'Plomberie SDB — raccordements', false, ''),
  (15, 5, 'Thomas Bernard', 5, '2026-05-22', '08:00', '17:00', 45, 'Ravalement façade sud — début', false, ''),
  (16, 4, 'Karim Diallo', 2, '2026-05-22', '07:00', '15:30', 45, 'Pose linteaux fenêtres R+1', false, ''),
  (17, 3, 'Ali Benali', 1, '2026-05-23', '07:30', '16:00', 45, 'Carrelage RDC — avancement 60%', false, ''),
  (18, 2, 'Marc Lefebvre', 1, '2026-05-23', '07:00', '16:30', 60, 'Plomberie SDB terminée + rapport hebdo', false, ''),
  (19, 5, 'Thomas Bernard', 5, '2026-05-23', '08:00', '16:00', 45, 'Ravalement façade sud — finition', false, ''),
  (20, 6, 'Kevin Simon', 5, '2026-05-23', '08:30', '15:00', 30, 'Retouches peinture + nettoyage chantier', false, ''),
  (21, 3, 'Ali Benali', 1, '2026-05-24', '07:30', '12:00', 0, 'Rattrapage carrelage — finition RDC', false, ''),
  (22, 2, 'Marc Lefebvre', 1, '2026-05-24', '07:00', '12:30', 0, 'Visite client + PV avancement', false, '')
ON CONFLICT (id) DO NOTHING;

SELECT setval('taches_id_seq', (SELECT COALESCE(MAX(id), 1) FROM taches));
SELECT setval('messages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM messages));
SELECT setval('avenants_id_seq', (SELECT COALESCE(MAX(id), 1) FROM avenants));
SELECT setval('heures_id_seq', (SELECT COALESCE(MAX(id), 1) FROM heures));
SELECT setval('punchlist_id_seq', (SELECT COALESCE(MAX(id), 1) FROM punchlist));
SELECT setval('rapports_id_seq', (SELECT COALESCE(MAX(id), 1) FROM rapports));
SELECT setval('equipe_id_seq', (SELECT COALESCE(MAX(id), 1) FROM equipe));
