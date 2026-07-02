-- Chat : pièces jointes (photos, PDF, vidéos) + bucket Storage

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS client_id TEXT;

COMMENT ON COLUMN messages.type IS 'text | image | video | pdf | file';
COMMENT ON COLUMN messages.attachments IS '[{ path, name, mime, size, thumb_path? }]';
COMMENT ON COLUMN messages.client_id IS 'ID client pour dédoublonnage sync offline';

CREATE INDEX IF NOT EXISTS idx_messages_chantier_created ON messages (chantier_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id ON messages (client_id) WHERE client_id IS NOT NULL;

ALTER TABLE messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chantier-media',
  'chantier-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS storage.objects déjà activé sur Supabase — ne pas ALTER TABLE storage.objects ici

DROP POLICY IF EXISTS chantier_media_select ON storage.objects;
DROP POLICY IF EXISTS chantier_media_insert ON storage.objects;
DROP POLICY IF EXISTS chantier_media_delete ON storage.objects;

CREATE POLICY chantier_media_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chantier-media'
    AND public.be_same_org((split_part(name, '/', 1))::uuid)
    AND public.be_can_access_chantier((split_part(name, '/', 2))::bigint)
  );

CREATE POLICY chantier_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chantier-media'
    AND public.be_same_org((split_part(name, '/', 1))::uuid)
    AND public.be_can_access_chantier((split_part(name, '/', 2))::bigint)
  );

CREATE POLICY chantier_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chantier-media'
    AND public.be_same_org((split_part(name, '/', 1))::uuid)
    AND public.be_profile_role() IN ('admin', 'chef')
  );
