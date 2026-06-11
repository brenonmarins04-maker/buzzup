-- ================================================================
-- BuzzUp — Formulários do workspace
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================

CREATE TABLE IF NOT EXISTS public.workspace_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  target_type text NOT NULL DEFAULT 'all',  -- 'all' | 'area' | 'team'
  target_value text,                        -- chave da área ou id do time
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_forms TO authenticated;
GRANT ALL ON public.workspace_forms TO service_role;
ALTER TABLE public.workspace_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wf_sel" ON public.workspace_forms;
CREATE POLICY "wf_sel" ON public.workspace_forms FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));
DROP POLICY IF EXISTS "wf_w" ON public.workspace_forms;
CREATE POLICY "wf_w" ON public.workspace_forms FOR ALL TO authenticated
  USING (public.is_admin_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

CREATE TABLE IF NOT EXISTS public.form_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.workspace_forms(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_completions TO authenticated;
GRANT ALL ON public.form_completions TO service_role;
ALTER TABLE public.form_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fc_sel" ON public.form_completions;
CREATE POLICY "fc_sel" ON public.form_completions FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));
-- Membro registra a própria conclusão
DROP POLICY IF EXISTS "fc_ins" ON public.form_completions;
CREATE POLICY "fc_ins" ON public.form_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_member_of(auth.uid(), workspace_id));
-- Membro desfaz a própria conclusão; admin pode remover qualquer uma
DROP POLICY IF EXISTS "fc_del" ON public.form_completions;
CREATE POLICY "fc_del" ON public.form_completions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_of(auth.uid(), workspace_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_forms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.form_completions;
ALTER TABLE public.workspace_forms REPLICA IDENTITY FULL;
ALTER TABLE public.form_completions REPLICA IDENTITY FULL;
