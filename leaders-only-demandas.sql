-- Líder é global mas só mexe em DEMANDAS. O leaders-setup.sql tinha dado
-- escrita de presenças ao líder também — este SQL volta presenças para
-- apenas diretores/owner (is_admin_of). Rode no SQL Editor do Supabase.

DROP POLICY IF EXISTS "ar_w" ON public.attendance_records;
CREATE POLICY "ar_w" ON public.attendance_records FOR ALL TO authenticated
  USING (public.is_admin_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "as_w" ON public.attendance_settings;
CREATE POLICY "as_w" ON public.attendance_settings FOR ALL TO authenticated
  USING (public.is_admin_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));
