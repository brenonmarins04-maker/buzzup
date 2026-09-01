-- ================================================================
-- BuzzUp — Agenda de reuniões semanais
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- As reuniões são SEMANAIS: cada uma tem um dia da semana e um horário,
-- e se repete toda semana. Os horários andam de 30 em 30 minutos.

-- ---------------------------------------------------------------
-- Salas
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#00B4D8',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meeting_rooms_ws_idx ON public.meeting_rooms(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_rooms TO authenticated;
GRANT ALL ON public.meeting_rooms TO service_role;
ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mr_sel" ON public.meeting_rooms;
CREATE POLICY "mr_sel" ON public.meeting_rooms FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));
-- Salas são configuração do workspace: só diretores/owner mexem
DROP POLICY IF EXISTS "mr_w" ON public.meeting_rooms;
CREATE POLICY "mr_w" ON public.meeting_rooms FOR ALL TO authenticated
  USING (public.is_admin_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_of(auth.uid(), workspace_id));

-- ---------------------------------------------------------------
-- Reuniões
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  -- Sala apagada não leva a reunião junto: ela só fica sem sala
  room_id uuid REFERENCES public.meeting_rooms(id) ON DELETE SET NULL,
  -- 0 = domingo ... 6 = sábado (mesma convenção do JavaScript)
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  -- Minutos desde a meia-noite, sempre em passos de 30
  start_min smallint NOT NULL CHECK (start_min >= 0 AND start_min < 1440 AND start_min % 30 = 0),
  end_min   smallint NOT NULL CHECK (end_min   > 0 AND end_min  <= 1440 AND end_min   % 30 = 0),
  CONSTRAINT meetings_horario_valido CHECK (end_min > start_min),
  -- 'team' | 'area' | 'people'
  target_type text NOT NULL DEFAULT 'people'
    CHECK (target_type IN ('team', 'area', 'people')),
  -- id do time ou chave da área; nulo quando são pessoas avulsas
  target_value text,
  -- Pessoas escolhidas uma a uma (target_type = 'people')
  person_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meetings_ws_weekday_idx ON public.meetings(workspace_id, weekday);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mt_sel" ON public.meetings;
CREATE POLICY "mt_sel" ON public.meetings FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), workspace_id));
-- Diretores e líderes marcam reuniões (mesma regra das demandas)
DROP POLICY IF EXISTS "mt_w" ON public.meetings;
CREATE POLICY "mt_w" ON public.meetings FOR ALL TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- ---------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE public.meeting_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.meetings      REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- Salas iniciais, para a agenda não começar vazia
-- ---------------------------------------------------------------
INSERT INTO public.meeting_rooms (workspace_id, name, color, position)
SELECT w.id, s.name, s.color, s.position
FROM public.workspaces w
CROSS JOIN (VALUES
  ('Sala 1',   '#00B4D8', 0),
  ('Sala 2',   '#F97316', 1),
  ('Online',   '#8B5CF6', 2)
) AS s(name, color, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meeting_rooms r WHERE r.workspace_id = w.id
);
