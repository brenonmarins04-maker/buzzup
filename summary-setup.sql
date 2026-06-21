-- Tabela para armazenar o resumo IA compartilhado por workspace
CREATE TABLE IF NOT EXISTS workspace_summaries (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  summary_text text NOT NULL DEFAULT '',
  generated_at timestamptz DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE workspace_summaries ENABLE ROW LEVEL SECURITY;

-- Todos os membros podem LER o resumo
CREATE POLICY "members_can_read_summary"
  ON workspace_summaries FOR SELECT
  USING (is_member_of(workspace_id));

-- Apenas admins/owners podem CRIAR ou ATUALIZAR
CREATE POLICY "admins_can_write_summary"
  ON workspace_summaries FOR ALL
  USING (is_admin_of(workspace_id));
