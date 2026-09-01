-- ================================================================
-- BuzzUp — Horários ocupados de cada pessoa
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- Rode o agenda-setup.sql antes deste.
--
-- Cada conta marca os horários em que NÃO está livre na semana (aula,
-- estágio, trabalho...). O que não estiver marcado conta como livre.
--
-- Substitui o antigo agenda-disponibilidade-setup.sql, que guardava o
-- contrário. Se você já tinha rodado aquele, este renomeia a tabela.

-- ---------------------------------------------------------------
-- 1) Renomeia a tabela antiga, se ela existir
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'availability_slots'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unavailable_slots'
  ) THEN
    ALTER TABLE public.availability_slots RENAME TO unavailable_slots;
    RAISE NOTICE 'Tabela renomeada de availability_slots para unavailable_slots.';
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 2) Cria a tabela (instalação nova)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unavailable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- 0 = domingo ... 6 = sábado
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min smallint NOT NULL CHECK (start_min >= 0 AND start_min < 1440 AND start_min % 30 = 0),
  end_min   smallint NOT NULL CHECK (end_min   > 0 AND end_min  <= 1440 AND end_min   % 30 = 0),
  CONSTRAINT unavailable_horario_valido CHECK (end_min > start_min),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unavailable_ws_user_idx
  ON public.unavailable_slots(workspace_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unavailable_slots TO authenticated;
GRANT ALL ON public.unavailable_slots TO service_role;
ALTER TABLE public.unavailable_slots ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer pessoa do workspace (é o que permite achar horário)
DROP POLICY IF EXISTS "av_sel" ON public.unavailable_slots;
DROP POLICY IF EXISTS "un_sel" ON public.unavailable_slots;
CREATE POLICY "un_sel" ON public.unavailable_slots FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));

-- Escrita: só a própria agenda. Nem diretor mexe na de outra pessoa.
DROP POLICY IF EXISTS "av_ins" ON public.unavailable_slots;
DROP POLICY IF EXISTS "un_ins" ON public.unavailable_slots;
CREATE POLICY "un_ins" ON public.unavailable_slots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_member_of(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "av_upd" ON public.unavailable_slots;
DROP POLICY IF EXISTS "un_upd" ON public.unavailable_slots;
CREATE POLICY "un_upd" ON public.unavailable_slots FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_member_of(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "av_del" ON public.unavailable_slots;
DROP POLICY IF EXISTS "un_del" ON public.unavailable_slots;
CREATE POLICY "un_del" ON public.unavailable_slots FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unavailable_slots;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE public.unavailable_slots REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- 3) Limpa o que foi marcado com o significado antigo
-- ---------------------------------------------------------------
-- ATENÇÃO: o significado dos blocos INVERTEU. O que alguém marcou como
-- "estou livre" viraria "estou ocupado" — o oposto do pretendido, e a busca
-- por horário passaria a errar para todo mundo. Por isso a limpeza.
--
-- Se você NÃO rodou o agenda-disponibilidade-setup.sql antes, esta linha não
-- apaga nada (a tabela está vazia). Se rodou e quer conferir antes, troque
-- por um SELECT e apague na mão.
DELETE FROM public.unavailable_slots;

-- ---------------------------------------------------------------
-- Conferência: deve aparecer uma linha
-- ---------------------------------------------------------------
SELECT table_name AS tabela_criada
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'unavailable_slots';
