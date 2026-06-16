-- ================================================================
-- BuzzUp — Liderança de áreas/times (líderes podem gerenciar demandas e calendário)
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================

-- 1) Coluna que persiste a liderança (antes só ficava no localStorage do admin).
--    Formato: chaves separadas por vírgula, ex.: "mercado,team_<uuid>"
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS leader_areas text;

-- 2) Funções auxiliares
-- É líder de algo neste workspace?
CREATE OR REPLACE FUNCTION public.is_leader_in(_user_id uuid, _ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.people
    WHERE user_id = _user_id
      AND workspace_id = _ws_id
      AND leader_areas IS NOT NULL
      AND btrim(leader_areas) <> ''
  );
$$;

-- "Gestor" = admin/owner OU líder de alguma área/time
CREATE OR REPLACE FUNCTION public.is_manager_of(_user_id uuid, _ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.is_admin_of(_user_id, _ws_id) OR public.is_leader_in(_user_id, _ws_id);
$$;

-- 3) Atualiza as policies de ESCRITA para permitir gestores (admin OU líder).
--    A leitura (SELECT) continua igual (qualquer membro). Só trocamos o write.

-- parking_items (demandas / Papel)
DROP POLICY IF EXISTS "pi_w" ON public.parking_items;
CREATE POLICY "pi_w" ON public.parking_items FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- tasks (demandas)
DROP POLICY IF EXISTS "tasks_w" ON public.tasks;
CREATE POLICY "tasks_w" ON public.tasks FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- posts (publicações)
DROP POLICY IF EXISTS "posts_w" ON public.posts;
CREATE POLICY "posts_w" ON public.posts FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- calendar_items (eventos)
DROP POLICY IF EXISTS "ci_w" ON public.calendar_items;
CREATE POLICY "ci_w" ON public.calendar_items FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- attendance_records (presenças)
DROP POLICY IF EXISTS "ar_w" ON public.attendance_records;
CREATE POLICY "ar_w" ON public.attendance_records FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- attendance_settings (config de presenças)
DROP POLICY IF EXISTS "as_w" ON public.attendance_settings;
CREATE POLICY "as_w" ON public.attendance_settings FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- task_assignees / post_assignees (vínculos de responsáveis) — herdam via tabela-mãe.
-- As policies originais checam admin pelo workspace da task/post; recriamos para gestor.
DROP POLICY IF EXISTS "ta_w" ON public.task_assignees;
CREATE POLICY "ta_w" ON public.task_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_manager_of(auth.uid(), t.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND public.is_manager_of(auth.uid(), t.workspace_id)));

DROP POLICY IF EXISTS "pa_w" ON public.post_assignees;
CREATE POLICY "pa_w" ON public.post_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_manager_of(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND public.is_manager_of(auth.uid(), p.workspace_id)));
