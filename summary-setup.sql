-- Cria tabela se ainda não existir
CREATE TABLE IF NOT EXISTS workspace_summaries (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  summary_text text NOT NULL DEFAULT '',
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id)
);

-- Adiciona coluna de resumos por área (se já tiver rodado o SQL anterior)
ALTER TABLE workspace_summaries
  ADD COLUMN IF NOT EXISTS summaries jsonb DEFAULT '{}'::jsonb;

ALTER TABLE workspace_summaries ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem (para não dar erro de duplicata)
DROP POLICY IF EXISTS "members_can_read_summary" ON workspace_summaries;
DROP POLICY IF EXISTS "admins_can_write_summary" ON workspace_summaries;

-- Todos os membros podem LER o resumo
CREATE POLICY "members_can_read_summary"
  ON workspace_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_summaries.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Apenas admins/owners podem CRIAR ou ATUALIZAR
CREATE POLICY "admins_can_write_summary"
  ON workspace_summaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_summaries.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('admin', 'owner')
    )
  );
