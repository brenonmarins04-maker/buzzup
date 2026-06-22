-- Rastrear logins diários por usuário/workspace (1 por dia por usuário)
CREATE TABLE IF NOT EXISTS user_daily_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id, login_date)
);

ALTER TABLE user_daily_logins ENABLE ROW LEVEL SECURITY;

-- Todos os membros podem inserir o próprio login
CREATE POLICY "members_insert_own_login"
  ON user_daily_logins FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = user_daily_logins.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Admins podem ler todos os logins do workspace
CREATE POLICY "admins_read_logins"
  ON user_daily_logins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = user_daily_logins.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('admin', 'owner')
    )
  );

-- Adiciona completed_at em parking_items para rastrear quando a demanda foi concluída
ALTER TABLE parking_items
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
