-- BuzzUp - Lixeira de workspaces
-- Seguro para dados existentes: adiciona colunas e funções idempotentes.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_after timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at ON public.workspaces(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_delete_after ON public.workspaces(delete_after);

CREATE OR REPLACE FUNCTION public.list_my_workspaces()
RETURNS TABLE(workspace_id uuid, name text, code text, role text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, w.code, m.role, w.created_at
  FROM public.workspace_members m
  JOIN public.workspaces w ON w.id = m.workspace_id
  WHERE m.user_id = auth.uid()
    AND w.deleted_at IS NULL
  ORDER BY w.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.list_my_trashed_workspaces()
RETURNS TABLE(workspace_id uuid, name text, code text, deleted_at timestamptz, delete_after timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, w.code, w.deleted_at, w.delete_after
  FROM public.workspaces w
  JOIN public.workspace_members m ON m.workspace_id = w.id
  WHERE m.user_id = auth.uid()
    AND m.role = 'owner'
    AND w.deleted_at IS NOT NULL
    AND w.delete_after > now()
  ORDER BY w.deleted_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.trash_workspace(_ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _ws_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only_owner_can_trash_workspace';
  END IF;

  UPDATE public.workspaces
  SET deleted_at = COALESCE(deleted_at, now()),
      delete_after = COALESCE(delete_after, now() + interval '14 days'),
      deleted_by = auth.uid()
  WHERE id = _ws_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_workspace(_ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _ws_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only_owner_can_restore_workspace';
  END IF;

  UPDATE public.workspaces
  SET deleted_at = NULL,
      delete_after = NULL,
      deleted_by = NULL
  WHERE id = _ws_id
    AND deleted_at IS NOT NULL
    AND delete_after > now();
END;
$$;

-- Limpa workspaces que completaram os 14 dias.
-- Rode manualmente ou por agendamento no Supabase quando quiser purgar de vez.
CREATE OR REPLACE FUNCTION public.purge_expired_trashed_workspaces()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.workspaces
  WHERE deleted_at IS NOT NULL
    AND delete_after <= now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_trashed_workspaces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trash_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_trashed_workspaces() TO authenticated;
