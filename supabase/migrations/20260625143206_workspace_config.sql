-- workspace_config: dedicated table for workspace-level configuration.
-- Replaces the __AREA_NAMES__: broadcast hack with a proper config table.
-- Existing broadcasts are preserved; their data is copied here automatically.

CREATE TABLE IF NOT EXISTS public.workspace_config (
  workspace_id uuid NOT NULL,
  area_names  jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id)
);

ALTER TABLE public.workspace_config ENABLE ROW LEVEL SECURITY;

-- All workspace members can read the config
CREATE POLICY "wsc_read_members" ON public.workspace_config
  FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));

-- Only the workspace owner can write
CREATE POLICY "wsc_write_owner" ON public.workspace_config
  FOR ALL TO authenticated
  USING (public.is_owner_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_owner_of(auth.uid(), workspace_id));

-- Enable Realtime so other members see name changes immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_config;

-- Migrate existing __AREA_NAMES__: broadcasts → workspace_config.
-- DISTINCT ON + ORDER BY created_at DESC picks the most recent per workspace.
-- ON CONFLICT DO NOTHING keeps any row already inserted.
INSERT INTO public.workspace_config (workspace_id, area_names)
SELECT DISTINCT ON (workspace_id)
  workspace_id,
  (substr(message, 16))::jsonb AS area_names
FROM public.broadcasts
WHERE left(message, 15) = '__AREA_NAMES__:'
ORDER BY workspace_id, created_at DESC
ON CONFLICT (workspace_id) DO NOTHING;
