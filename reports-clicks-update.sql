-- Atualiza user_daily_logins para registrar múltiplas "entradas" (cliques) por dia,
-- em vez de apenas 1 por dia. O debounce de 15 minutos é controlado pela aplicação
-- (consulta a última entrada antes de inserir uma nova).

ALTER TABLE user_daily_logins DROP CONSTRAINT IF EXISTS user_daily_logins_workspace_id_user_id_login_date_key;

-- Índice para buscar rapidamente a última entrada de um usuário (usado no debounce de 15 min)
CREATE INDEX IF NOT EXISTS idx_user_daily_logins_last_click
  ON user_daily_logins (workspace_id, user_id, created_at DESC);
