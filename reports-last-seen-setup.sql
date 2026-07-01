-- Guarda quando cada usuário entrou por último em cada workspace, para calcular
-- quantos pontos de gamificação ele ganhou desde a última visita e mostrar a
-- notificação "Você ganhou X pontos!" ao entrar novamente.

CREATE TABLE IF NOT EXISTS user_workspace_last_seen (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE user_workspace_last_seen ENABLE ROW LEVEL SECURITY;

-- Cada usuário só lê/grava a própria marca de "última vez visto"
CREATE POLICY "members_manage_own_last_seen"
  ON user_workspace_last_seen FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
