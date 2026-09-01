-- ================================================================
-- BuzzUp — Disponibilidade semanal de cada pessoa
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Rode o agenda-setup.sql antes deste.
--
-- Cada conta marca os horários em que costuma estar livre na semana. Todo
-- mundo do workspace LÊ a disponibilidade alheia (é o que permite achar um
-- horário em comum), mas cada um só ESCREVE a própria.

CREATE TABLE IF NOT EXISTS public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- 0 = domingo ... 6 = sábado
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min smallint NOT NULL CHECK (start_min >= 0 AND start_min < 1440 AND start_min % 30 = 0),
  end_min   smallint NOT NULL CHECK (end_min   > 0 AND end_min  <= 1440 AND end_min   % 30 = 0),
  CONSTRAINT availability_horario_valido CHECK (end_min > start_min),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS availability_ws_user_idx
  ON public.availability_slots(workspace_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer pessoa do workspace (necessário para achar horário)
DROP POLICY IF EXISTS "av_sel" ON public.availability_slots;
CREATE POLICY "av_sel" ON public.availability_slots FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));

-- Escrita: só a própria disponibilidade, e só dentro de um workspace seu.
-- Nem diretor mexe na agenda pessoal de outra pessoa.
DROP POLICY IF EXISTS "av_ins" ON public.availability_slots;
CREATE POLICY "av_ins" ON public.availability_slots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_member_of(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "av_upd" ON public.availability_slots;
CREATE POLICY "av_upd" ON public.availability_slots FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_member_of(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "av_del" ON public.availability_slots;
CREATE POLICY "av_del" ON public.availability_slots FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE public.availability_slots REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- Conferência: deve aparecer uma linha
-- ---------------------------------------------------------------
SELECT table_name AS tabela_criada
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'availability_slots';
