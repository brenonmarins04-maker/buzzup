-- ================================================================
-- BuzzUp — Demandas propostas pelo próprio membro
-- Cole isso no SQL Editor do Supabase e clique Run ▶
-- ================================================================
-- O membro propõe uma demanda para si. Ela fica na fila até um líder ou
-- diretor aceitar; só então vira demanda de verdade (parking_items).

CREATE TABLE IF NOT EXISTS public.demand_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- Chave da área ("mercado") ou do time ("team_<uuid>"), igual a parking_items
  area text NOT NULL,
  title text NOT NULL,
  points int NOT NULL DEFAULT 1 CHECK (points >= 0 AND points <= 99),
  -- Prazo é opcional
  date date,
  -- Quem vai fazer (a própria pessoa que propôs)
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demand_requests_ws_status_idx
  ON public.demand_requests(workspace_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_requests TO authenticated;
GRANT ALL ON public.demand_requests TO service_role;
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;

-- Leitura: gestores veem tudo; o membro vê os próprios pedidos, para
-- acompanhar se já foi aceito
DROP POLICY IF EXISTS "dr_sel" ON public.demand_requests;
CREATE POLICY "dr_sel" ON public.demand_requests FOR SELECT TO authenticated
  USING (
    public.is_manager_of(auth.uid(), workspace_id)
    OR requested_by = auth.uid()
  );

-- Qualquer membro propõe, mas só em nome próprio
DROP POLICY IF EXISTS "dr_ins" ON public.demand_requests;
CREATE POLICY "dr_ins" ON public.demand_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_member_of(auth.uid(), workspace_id)
  );

-- Aceitar, revisar e recusar é de líder ou diretor
DROP POLICY IF EXISTS "dr_upd" ON public.demand_requests;
CREATE POLICY "dr_upd" ON public.demand_requests FOR UPDATE TO authenticated
  USING (public.is_manager_of(auth.uid(), workspace_id))
  WITH CHECK (public.is_manager_of(auth.uid(), workspace_id));

-- O autor pode desistir enquanto ninguém decidiu; gestor apaga qualquer um
DROP POLICY IF EXISTS "dr_del" ON public.demand_requests;
CREATE POLICY "dr_del" ON public.demand_requests FOR DELETE TO authenticated
  USING (
    public.is_manager_of(auth.uid(), workspace_id)
    OR (requested_by = auth.uid() AND status = 'pending')
  );

-- Realtime: o pedido precisa aparecer na hora para quem decide
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demand_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
ALTER TABLE public.demand_requests REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------
-- Conferência: deve aparecer uma linha
-- ---------------------------------------------------------------
SELECT table_name AS tabela_criada
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'demand_requests';
